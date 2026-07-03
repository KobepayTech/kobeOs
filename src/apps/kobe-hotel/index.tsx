import { useState, useMemo, useEffect } from 'react';
import { useOfflineData } from '@/hooks/useOfflineData';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import { HotelAdminDashboard } from './HotelAdminDashboard';
import { KDSDisplay } from './KDSDisplay';
import { QRCustomerPortal } from './QRCustomerPortal';
import HotelBookersDashboard from './HotelBookersDashboard';
import ChannelsTab from './ChannelsTab';
import GuestInboxTab from './GuestInboxTab';
import RoomsBoard from './RoomsBoard';
import FoodListBoard from './FoodListBoard';
import type { Hotel as SharedHotel, Order as SharedOrder } from '@/shared/types';
import { useHotelLive, type HotelOrder as LiveOrder } from './useHotelLive';

// Adapt the live hotel-order feed (useHotelLive) to the KDS component's Order
// model so the KDS tab shows real, live orders instead of an empty array.
const HOTEL_TO_KDS_STATUS: Record<LiveOrder['status'], SharedOrder['status']> = {
  PENDING: 'pending', ACCEPTED: 'preparing', PREPARING: 'preparing',
  READY: 'ready', DELIVERED: 'served', CANCELLED: 'cancelled',
};
function toKdsOrders(orders: LiveOrder[]): SharedOrder[] {
  return orders.map((o) => {
    const items = (o.items ?? []).map((it, idx) => ({
      id: it.menuItemId ?? `${o.id}-${idx}`,
      menuItemId: it.menuItemId ?? '',
      name: it.name,
      quantity: it.qty,
      unitPrice: it.price,
      totalPrice: it.price * it.qty,
      station: (it.station === 'bar' ? 'bar' : 'kitchen') as SharedOrder['items'][number]['station'],
      status: (HOTEL_TO_KDS_STATUS[o.status] === 'ready' ? 'ready' : 'preparing') as SharedOrder['items'][number]['status'],
    }));
    const stations = new Set(items.map((i) => i.station));
    const orderStation: SharedOrder['station'] = stations.size > 1 ? 'mixed' : (items[0]?.station ?? 'kitchen');
    return {
      id: o.id,
      roomId: o.roomNumber,
      guestName: o.guestName ?? undefined,
      items,
      status: HOTEL_TO_KDS_STATUS[o.status] ?? 'pending',
      subtotal: Number(o.total) || 0,
      tax: 0,
      serviceCharge: 0,
      total: Number(o.total) || 0,
      paymentStatus: 'unpaid',
      createdAt: o.createdAt ?? new Date().toISOString(),
      updatedAt: o.createdAt ?? new Date().toISOString(),
      station: orderStation,
    } as SharedOrder;
  });
}
import { buildPublicGuestUrl } from '@/public/api';
import {
  Building2, LayoutDashboard, ConciergeBell, Bed, Wine, UtensilsCrossed,
  Package, Users, Calculator, QrCode, Plus, Minus, Search, Trash2,
  CheckCircle2, Clock, X, Check, Printer, Smartphone,
  Banknote, Receipt, Calendar, Phone, User,
  ArrowLeft, Download, TrendingUp, AlertTriangle, Star, Lock,
  Unlock, Eye, Send, Moon, Sun, GlassWater, Beef, CakeSlice,
  Coffee, ChefHat, Brush, ShieldCheck, CircleDollarSign,
  Globe2, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────
type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance';
interface Room {
  id: number;
  number: string;
  type: string;
  status: RoomStatus;
  price: number;
  guest?: string;
  floor: number;
  beds: number;
}
interface Guest {
  id: number;
  name: string;
  room: string;
  phone: string;
  email: string;
  idNumber: string;
  nationality: string;
  checkIn: string;
  checkOut: string;
  status: 'Checked-in' | 'Checked-out' | 'Reserved';
  guests: number;
  paymentMethod: string;
  balance: number;
}
interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  stock: number;
}
interface PortalOrder {
  id: string;
  roomNumber: string;
  guestName?: string | null;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number | string;
  currency: string;
  status: string;
  note?: string;
  createdAt?: string;
}

interface PortalServiceRequest {
  id: string;
  roomNumber: string;
  kind: string;
  note?: string;
  status: string;
  createdAt?: string;
}

// Mirrors the server-side transition maps in hotel.service.ts.
const NEXT_ORDER_STATUS: Record<string, Array<'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'>> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};
const NEXT_REQUEST_STATUS: Record<string, Array<'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

interface CartItem extends MenuItem {
  qty: number;
}
interface StaffMember {
  id: number;
  name: string;
  role: string;
  status: 'On Duty' | 'Off' | 'On Leave';
  shift: string;
  phone: string;
  sales?: number;
}
interface InventoryItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  status: 'In Stock' | 'Low' | 'Out';
  lastRestocked: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────
const COLORS = { available: '#10b981', occupied: '#ef4444', cleaning: '#f59e0b', maintenance: '#64748b', cyan: '#06b6d4', blue: '#3b82f6', emerald: '#10b981', amber: '#f59e0b', orange: '#f97316', violet: '#8b5cf6', sky: '#0ea5e9', green: '#22c55e', pink: '#ec4899' };
const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

const ROOMS: Room[] = [
  { id: 1, number: '101', type: 'Standard', status: 'occupied', price: 35000, guest: 'Juma Bakari', floor: 1, beds: 1 },
  { id: 2, number: '102', type: 'Standard', status: 'available', price: 35000, floor: 1, beds: 1 },
  { id: 3, number: '103', type: 'Standard', status: 'occupied', price: 35000, guest: 'Asha Mwinyi', floor: 1, beds: 2 },
  { id: 4, number: '104', type: 'Standard', status: 'cleaning', price: 35000, floor: 1, beds: 1 },
  { id: 5, number: '105', type: 'Standard', status: 'available', price: 35000, floor: 1, beds: 1 },
  { id: 6, number: '106', type: 'Standard', status: 'occupied', price: 35000, guest: 'Omari Seif', floor: 1, beds: 1 },
  { id: 7, number: '107', type: 'Standard', status: 'occupied', price: 35000, guest: 'Fatima Said', floor: 1, beds: 2 },
  { id: 8, number: '108', type: 'Standard', status: 'maintenance', price: 35000, floor: 1, beds: 1 },
  { id: 9, number: '109', type: 'Standard', status: 'available', price: 35000, floor: 1, beds: 1 },
  { id: 10, number: '110', type: 'Standard', status: 'occupied', price: 35000, guest: 'Hassan Khamis', floor: 1, beds: 1 },
  { id: 11, number: '201', type: 'Deluxe', status: 'occupied', price: 65000, guest: 'Sarah Johnson', floor: 2, beds: 1 },
  { id: 12, number: '202', type: 'Deluxe', status: 'available', price: 65000, floor: 2, beds: 2 },
  { id: 13, number: '203', type: 'Deluxe', status: 'occupied', price: 65000, guest: 'Michael Chen', floor: 2, beds: 1 },
  { id: 14, number: '204', type: 'Deluxe', status: 'occupied', price: 65000, guest: 'Emma Wilson', floor: 2, beds: 2 },
  { id: 15, number: '205', type: 'Deluxe', status: 'cleaning', price: 65000, floor: 2, beds: 1 },
  { id: 16, number: '206', type: 'Deluxe', status: 'available', price: 65000, floor: 2, beds: 1 },
  { id: 17, number: '301', type: 'VIP Suite', status: 'occupied', price: 120000, guest: 'Dr. Rajesh Patel', floor: 3, beds: 1 },
  { id: 18, number: '302', type: 'VIP Suite', status: 'occupied', price: 120000, guest: 'Amara Okafor', floor: 3, beds: 2 },
  { id: 19, number: '303', type: 'VIP Suite', status: 'available', price: 120000, floor: 3, beds: 1 },
  { id: 20, number: '304', type: 'VIP Suite', status: 'occupied', price: 120000, guest: 'James Omondi', floor: 3, beds: 2 },
];

const GUESTS: Guest[] = [
  { id: 1, name: 'Juma Bakari', room: '101', phone: '+255 712 345 678', email: 'juma.b@gmail.com', idNumber: 'TZ123456', nationality: 'Tanzanian', checkIn: '2024-06-10', checkOut: '2024-06-15', status: 'Checked-in', guests: 1, paymentMethod: 'M-Pesa', balance: 0 },
  { id: 2, name: 'Asha Mwinyi', room: '103', phone: '+255 723 456 789', email: 'asha.m@yahoo.com', idNumber: 'TZ234567', nationality: 'Tanzanian', checkIn: '2024-06-12', checkOut: '2024-06-14', status: 'Checked-in', guests: 2, paymentMethod: 'Cash', balance: 35000 },
  { id: 3, name: 'Omari Seif', room: '106', phone: '+255 734 567 890', email: 'omari.s@gmail.com', idNumber: 'TZ345678', nationality: 'Kenyan', checkIn: '2024-06-11', checkOut: '2024-06-16', status: 'Checked-in', guests: 1, paymentMethod: 'Card', balance: 0 },
  { id: 4, name: 'Fatima Said', room: '107', phone: '+255 745 678 901', email: 'fatima.s@outlook.com', idNumber: 'TZ456789', nationality: 'Tanzanian', checkIn: '2024-06-13', checkOut: '2024-06-15', status: 'Checked-in', guests: 2, paymentMethod: 'M-Pesa', balance: 65000 },
  { id: 5, name: 'Hassan Khamis', room: '110', phone: '+255 756 789 012', email: 'hassan.k@gmail.com', idNumber: 'TZ567890', nationality: 'Ugandan', checkIn: '2024-06-10', checkOut: '2024-06-17', status: 'Checked-in', guests: 1, paymentMethod: 'Bank', balance: 0 },
  { id: 6, name: 'Sarah Johnson', room: '201', phone: '+1 555 123 4567', email: 'sarah.j@email.com', idNumber: 'US789012', nationality: 'American', checkIn: '2024-06-11', checkOut: '2024-06-18', status: 'Checked-in', guests: 1, paymentMethod: 'Card', balance: 130000 },
  { id: 7, name: 'Michael Chen', room: '203', phone: '+86 138 0000 1111', email: 'm.chen@email.com', idNumber: 'CN890123', nationality: 'Chinese', checkIn: '2024-06-12', checkOut: '2024-06-16', status: 'Checked-in', guests: 1, paymentMethod: 'Card', balance: 0 },
  { id: 8, name: 'Emma Wilson', room: '204', phone: '+44 7700 900123', email: 'emma.w@email.com', idNumber: 'UK901234', nationality: 'British', checkIn: '2024-06-09', checkOut: '2024-06-15', status: 'Checked-in', guests: 2, paymentMethod: 'M-Pesa', balance: 65000 },
  { id: 9, name: 'Dr. Rajesh Patel', room: '301', phone: '+91 98765 43210', email: 'rajesh.p@email.com', idNumber: 'IN012345', nationality: 'Indian', checkIn: '2024-06-10', checkOut: '2024-06-20', status: 'Checked-in', guests: 1, paymentMethod: 'Card', balance: 240000 },
  { id: 10, name: 'Amara Okafor', room: '302', phone: '+234 803 456 7890', email: 'amara.o@email.com', idNumber: 'NG123456', nationality: 'Nigerian', checkIn: '2024-06-11', checkOut: '2024-06-19', status: 'Checked-in', guests: 2, paymentMethod: 'Bank', balance: 0 },
  { id: 11, name: 'James Omondi', room: '304', phone: '+255 767 890 123', email: 'james.o@gmail.com', idNumber: 'KE234567', nationality: 'Kenyan', checkIn: '2024-06-12', checkOut: '2024-06-16', status: 'Checked-in', guests: 2, paymentMethod: 'M-Pesa', balance: 120000 },
  { id: 12, name: 'Grace Mwangi', room: '-', phone: '+255 778 901 234', email: 'grace.m@email.com', idNumber: 'TZ678901', nationality: 'Tanzanian', checkIn: '2024-06-14', checkOut: '2024-06-18', status: 'Reserved', guests: 1, paymentMethod: 'M-Pesa', balance: 0 },
  { id: 13, name: 'Peter Njoroge', room: '-', phone: '+255 789 012 345', email: 'peter.n@gmail.com', idNumber: 'KE789012', nationality: 'Kenyan', checkIn: '2024-06-14', checkOut: '2024-06-17', status: 'Reserved', guests: 1, paymentMethod: 'Cash', balance: 0 },
  { id: 14, name: 'Lucy Akello', room: '-', phone: '+256 701 234 567', email: 'lucy.a@email.com', idNumber: 'UG890123', nationality: 'Ugandan', checkIn: '2024-06-14', checkOut: '2024-06-20', status: 'Reserved', guests: 2, paymentMethod: 'Card', balance: 0 },
  { id: 15, name: 'David Kimaro', room: '-', phone: '+255 790 123 456', email: 'david.k@email.com', idNumber: 'TZ901234', nationality: 'Tanzanian', checkIn: '2024-06-14', checkOut: '2024-06-16', status: 'Reserved', guests: 1, paymentMethod: 'M-Pesa', balance: 0 },
];

const BAR_ITEMS: MenuItem[] = [
  { id: 1, name: 'Safari Lager', price: 3500, category: 'Beer', stock: 48 },
  { id: 2, name: 'Kilimanjaro', price: 3500, category: 'Beer', stock: 36 },
  { id: 3, name: 'Tusker', price: 4000, category: 'Beer', stock: 24 },
  { id: 4, name: 'Serengeti', price: 4500, category: 'Beer', stock: 30 },
  { id: 5, name: 'Heineken', price: 5000, category: 'Beer', stock: 20 },
  { id: 6, name: 'Smirnoff Vodka', price: 5000, category: 'Spirits', stock: 15 },
  { id: 7, name: "Gordon's Gin", price: 5500, category: 'Spirits', stock: 12 },
  { id: 8, name: 'Jack Daniels', price: 8000, category: 'Spirits', stock: 10 },
  { id: 9, name: 'Johnnie Walker', price: 7000, category: 'Spirits', stock: 14 },
  { id: 10, name: 'Red Wine', price: 12000, category: 'Wine', stock: 8 },
  { id: 11, name: 'White Wine', price: 12000, category: 'Wine', stock: 6 },
  { id: 12, name: 'Coca Cola', price: 2000, category: 'Soft Drinks', stock: 60 },
  { id: 13, name: 'Sprite', price: 2000, category: 'Soft Drinks', stock: 55 },
  { id: 14, name: 'Fanta', price: 2000, category: 'Soft Drinks', stock: 50 },
  { id: 15, name: 'Water', price: 1000, category: 'Soft Drinks', stock: 100 },
  { id: 16, name: 'Mojito', price: 8000, category: 'Cocktails', stock: 20 },
  { id: 17, name: 'Margarita', price: 8500, category: 'Cocktails', stock: 15 },
  { id: 18, name: 'Long Island', price: 10000, category: 'Cocktails', stock: 12 },
  { id: 19, name: 'Pina Colada', price: 9000, category: 'Cocktails', stock: 18 },
  { id: 20, name: 'Cosmopolitan', price: 8500, category: 'Cocktails', stock: 10 },
  { id: 21, name: 'Nuts', price: 3000, category: 'Snacks', stock: 40 },
  { id: 22, name: 'Chips', price: 2500, category: 'Snacks', stock: 35 },
  { id: 23, name: 'Samosa', price: 2000, category: 'Snacks', stock: 25 },
  { id: 24, name: 'Meat Pie', price: 2500, category: 'Snacks', stock: 20 },
];

const FOOD_ITEMS: MenuItem[] = [
  { id: 101, name: 'Full English', price: 8000, category: 'Breakfast', stock: 20 },
  { id: 102, name: 'Pancakes', price: 5500, category: 'Breakfast', stock: 15 },
  { id: 103, name: 'Fruit Platter', price: 4000, category: 'Breakfast', stock: 10 },
  { id: 104, name: 'Toast & Eggs', price: 3500, category: 'Breakfast', stock: 25 },
  { id: 105, name: 'Coffee/Tea', price: 1500, category: 'Breakfast', stock: 50 },
  { id: 106, name: 'Chicken Curry', price: 7500, category: 'Lunch', stock: 18 },
  { id: 107, name: 'Beef Stew', price: 7000, category: 'Lunch', stock: 20 },
  { id: 108, name: 'Fish Fillet', price: 9000, category: 'Lunch', stock: 12 },
  { id: 109, name: 'Veggie Plate', price: 5500, category: 'Lunch', stock: 15 },
  { id: 110, name: 'Pilau', price: 6500, category: 'Lunch', stock: 22 },
  { id: 111, name: 'Chapati', price: 1000, category: 'Lunch', stock: 40 },
  { id: 112, name: 'Ugali & Nyama', price: 6000, category: 'Lunch', stock: 25 },
  { id: 113, name: 'Grilled Chicken', price: 9500, category: 'Dinner', stock: 16 },
  { id: 114, name: 'T-Bone Steak', price: 14000, category: 'Dinner', stock: 10 },
  { id: 115, name: 'Pasta Carbonara', price: 8500, category: 'Dinner', stock: 14 },
  { id: 116, name: 'Seafood Platter', price: 16000, category: 'Dinner', stock: 8 },
  { id: 117, name: 'Lamb Chops', price: 15000, category: 'Dinner', stock: 9 },
  { id: 118, name: 'Zanzibar Pizza', price: 3500, category: 'Swahili', stock: 20 },
  { id: 119, name: 'Mishkaki', price: 4000, category: 'Swahili', stock: 25 },
  { id: 120, name: 'Urojo', price: 3000, category: 'Swahili', stock: 15 },
  { id: 121, name: 'Mandazi', price: 1000, category: 'Swahili', stock: 50 },
  { id: 122, name: 'Biriani', price: 8000, category: 'Swahili', stock: 18 },
  { id: 123, name: 'Chocolate Cake', price: 4500, category: 'Desserts', stock: 12 },
  { id: 124, name: 'Ice Cream', price: 3000, category: 'Desserts', stock: 20 },
  { id: 125, name: 'Fruit Salad', price: 3500, category: 'Desserts', stock: 15 },
  { id: 126, name: 'Cheesecake', price: 5000, category: 'Desserts', stock: 10 },
];

const STAFF: StaffMember[] = [
  { id: 1, name: 'Joseph Mwakalinga', role: 'Manager', status: 'On Duty', shift: '8AM - 5PM', phone: '+255 712 111 222', sales: 0 },
  { id: 2, name: 'Amina Rashid', role: 'Receptionist', status: 'On Duty', shift: '8AM - 4PM', phone: '+255 712 222 333', sales: 0 },
  { id: 3, name: 'Khalid Omari', role: 'Receptionist', status: 'Off', shift: '4PM - 12AM', phone: '+255 712 333 444', sales: 0 },
  { id: 4, name: 'Daniel Moshi', role: 'Waiter', status: 'On Duty', shift: '7AM - 3PM', phone: '+255 712 444 555', sales: 420000 },
  { id: 5, name: 'Grace Thomas', role: 'Waiter', status: 'On Duty', shift: '12PM - 8PM', phone: '+255 712 555 666', sales: 380000 },
  { id: 6, name: 'Peter Kavishe', role: 'Waiter', status: 'On Leave', shift: '4PM - 12AM', phone: '+255 712 666 777', sales: 310000 },
  { id: 7, name: 'Chef Hassan', role: 'Chef', status: 'On Duty', shift: '6AM - 2PM', phone: '+255 712 777 888', sales: 0 },
  { id: 8, name: 'Chef Maria', role: 'Chef', status: 'On Duty', shift: '2PM - 10PM', phone: '+255 712 888 999', sales: 0 },
  { id: 9, name: 'Baraka Suleiman', role: 'Bartender', status: 'On Duty', shift: '4PM - 12AM', phone: '+255 712 999 000', sales: 450000 },
  { id: 10, name: 'Lilian James', role: 'Bartender', status: 'Off', shift: '12PM - 8PM', phone: '+255 713 000 111', sales: 320000 },
  { id: 11, name: 'Mariam Juma', role: 'Cleaner', status: 'On Duty', shift: '8AM - 4PM', phone: '+255 713 111 222', sales: 0 },
  { id: 12, name: 'Steven Lema', role: 'Cleaner', status: 'On Leave', shift: '4PM - 12AM', phone: '+255 713 222 333', sales: 0 },
  { id: 13, name: 'John Mrema', role: 'Security', status: 'On Duty', shift: '8AM - 8PM', phone: '+255 713 333 444', sales: 0 },
  { id: 14, name: 'Frank Joseph', role: 'Security', status: 'On Duty', shift: '8PM - 8AM', phone: '+255 713 444 555', sales: 0 },
];

const INVENTORY: InventoryItem[] = [
  { id: 1, name: 'Beer Crates', category: 'Bar Stock', quantity: 24, unit: 'crates', minThreshold: 10, status: 'In Stock', lastRestocked: '2024-06-10' },
  { id: 2, name: 'Vodka Bottles', category: 'Bar Stock', quantity: 12, unit: 'bottles', minThreshold: 5, status: 'In Stock', lastRestocked: '2024-06-08' },
  { id: 3, name: 'Gin Bottles', category: 'Bar Stock', quantity: 8, unit: 'bottles', minThreshold: 5, status: 'Low', lastRestocked: '2024-06-05' },
  { id: 4, name: 'Whiskey Bottles', category: 'Bar Stock', quantity: 3, unit: 'bottles', minThreshold: 4, status: 'Low', lastRestocked: '2024-06-01' },
  { id: 5, name: 'Wine Bottles', category: 'Bar Stock', quantity: 2, unit: 'bottles', minThreshold: 6, status: 'Out', lastRestocked: '2024-05-28' },
  { id: 6, name: 'Rice Bags (50kg)', category: 'Food Ingredients', quantity: 8, unit: 'bags', minThreshold: 5, status: 'In Stock', lastRestocked: '2024-06-12' },
  { id: 7, name: 'Chicken (kg)', category: 'Food Ingredients', quantity: 20, unit: 'kg', minThreshold: 10, status: 'In Stock', lastRestocked: '2024-06-13' },
  { id: 8, name: 'Beef (kg)', category: 'Food Ingredients', quantity: 15, unit: 'kg', minThreshold: 10, status: 'In Stock', lastRestocked: '2024-06-13' },
  { id: 9, name: 'Cooking Oil (L)', category: 'Food Ingredients', quantity: 10, unit: 'liters', minThreshold: 8, status: 'Low', lastRestocked: '2024-06-11' },
  { id: 10, name: 'Flour (kg)', category: 'Food Ingredients', quantity: 25, unit: 'kg', minThreshold: 15, status: 'In Stock', lastRestocked: '2024-06-10' },
  { id: 11, name: 'Vegetables (kg)', category: 'Food Ingredients', quantity: 30, unit: 'kg', minThreshold: 10, status: 'In Stock', lastRestocked: '2024-06-14' },
  { id: 12, name: 'Cleaning Liquid', category: 'Cleaning Supplies', quantity: 20, unit: 'bottles', minThreshold: 10, status: 'In Stock', lastRestocked: '2024-06-09' },
  { id: 13, name: 'Toilet Paper', category: 'Cleaning Supplies', quantity: 100, unit: 'rolls', minThreshold: 30, status: 'In Stock', lastRestocked: '2024-06-08' },
  { id: 14, name: 'Laundry Detergent', category: 'Cleaning Supplies', quantity: 12, unit: 'kg', minThreshold: 5, status: 'In Stock', lastRestocked: '2024-06-07' },
  { id: 15, name: 'Soap Bars', category: 'Room Amenities', quantity: 50, unit: 'bars', minThreshold: 20, status: 'In Stock', lastRestocked: '2024-06-06' },
  { id: 16, name: 'Shampoo Bottles', category: 'Room Amenities', quantity: 30, unit: 'bottles', minThreshold: 15, status: 'In Stock', lastRestocked: '2024-06-06' },
  { id: 17, name: 'Towels', category: 'Room Amenities', quantity: 40, unit: 'pieces', minThreshold: 20, status: 'In Stock', lastRestocked: '2024-06-05' },
  { id: 18, name: 'Bedding Sets', category: 'Room Amenities', quantity: 25, unit: 'sets', minThreshold: 15, status: 'In Stock', lastRestocked: '2024-06-04' },
  { id: 19, name: 'Sugar (kg)', category: 'Food Ingredients', quantity: 5, unit: 'kg', minThreshold: 10, status: 'Low', lastRestocked: '2024-06-02' },
  { id: 20, name: 'Salt (kg)', category: 'Food Ingredients', quantity: 8, unit: 'kg', minThreshold: 5, status: 'In Stock', lastRestocked: '2024-06-03' },
];

const REVENUE_DATA = [
  { day: 'Mon', bar: 320000, restaurant: 480000, rooms: 560000 },
  { day: 'Tue', bar: 280000, restaurant: 420000, rooms: 490000 },
  { day: 'Wed', bar: 350000, restaurant: 510000, rooms: 630000 },
  { day: 'Thu', bar: 450000, restaurant: 680000, rooms: 720000 },
  { day: 'Fri', bar: 520000, restaurant: 750000, rooms: 810000 },
  { day: 'Sat', bar: 480000, restaurant: 820000, rooms: 900000 },
  { day: 'Sun', bar: 390000, restaurant: 650000, rooms: 740000 },
];

const OCCUPANCY_DATA = [
  { day: 'Mon', rate: 65 },
  { day: 'Tue', rate: 70 },
  { day: 'Wed', rate: 75 },
  { day: 'Thu', rate: 85 },
  { day: 'Fri', rate: 90 },
  { day: 'Sat', rate: 95 },
  { day: 'Sun', rate: 80 },
];

const REVENUE_PIE = [
  { name: 'Rooms', value: 45 },
  { name: 'Restaurant', value: 35 },
  { name: 'Bar', value: 20 },
];

const ACTIVITIES = [
  { id: 1, text: 'Guest Juma Bakari checked in to Room 101', time: '2 hours ago', type: 'checkin' },
  { id: 2, text: 'Room service order delivered to Room 204', time: '3 hours ago', type: 'service' },
  { id: 3, text: 'Guest Emma Wilson checked out from Room 204', time: '4 hours ago', type: 'checkout' },
  { id: 4, text: 'Low stock alert: Wine Bottles (2 remaining)', time: '5 hours ago', type: 'alert' },
  { id: 5, text: 'Bar order #45 completed - TZS 34,500', time: '5 hours ago', type: 'order' },
  { id: 6, text: 'Room 104 marked for cleaning', time: '6 hours ago', type: 'cleaning' },
];

const RESTAURANT_TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  seats: i < 4 ? 2 : i < 8 ? 4 : i < 10 ? 6 : 8,
  status: i === 1 || i === 4 || i === 6 ? 'occupied' : i === 3 || i === 9 ? 'reserved' : 'available' as 'available' | 'occupied' | 'reserved',
  guest: i === 1 ? 'Juma Bakari' : i === 4 ? 'Sarah Johnson' : i === 6 ? 'Michael Chen' : undefined,
}));

const EXPENSE_DATA = [
  { category: 'Salaries', amount: 2800000 },
  { category: 'Supplies', amount: 1200000 },
  { category: 'Utilities', amount: 850000 },
  { category: 'Maintenance', amount: 450000 },
];

// ─── Utility Functions ───────────────────────────────────────────────
function formatTZS(n: number) {
  if (n >= 1000000) return `TZS ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `TZS ${(n / 1000).toFixed(0)}K`;
  return `TZS ${n}`;
}

function statusBadge(status: RoomStatus | string) {
  const map: Record<string, { color: string; label: string }> = {
    available: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Available' },
    occupied: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Occupied' },
    cleaning: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Cleaning' },
    maintenance: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Maintenance' },
    'Checked-in': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Checked-in' },
    'Checked-out': { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Checked-out' },
    Reserved: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Reserved' },
    'In Stock': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'In Stock' },
    Low: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Low' },
    Out: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Out' },
    'On Duty': { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'On Duty' },
    Off: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Off' },
    'On Leave': { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'On Leave' },
  };
  const s = map[status] || { color: 'bg-slate-500/20 text-slate-400', label: status };
  return <Badge variant="outline" className={s.color}>{s.label}</Badge>;
}

// ═══════════════════════════════════════════════════════════════════════
// KOBEHOTEL OS - Main Component
// ═══════════════════════════════════════════════════════════════════════
export default function KobeHotel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [staff, setStaff] = useState<StaffMember[]>(STAFF);
  const [inventory] = useState<InventoryItem[]>(INVENTORY);
  const [darkMode, setDarkMode] = useState(true);

  // Load rooms + guests from SQLite first, then sync from backend.
  const { data: rooms, setData: setRooms } = useOfflineData<Room>({
    table: 'hotel_rooms',
    apiPath: '/hotel/rooms',
    seed: ROOMS,
  });
  const { data: guests, setData: setGuests } = useOfflineData<Guest>({
    table: 'hotel_bookings',
    apiPath: '/hotel/bookings',
    seed: GUESTS,
  });

  // Bar POS state
  const [barCategory, setBarCategory] = useState('Beer');
  const [barCart, setBarCart] = useState<CartItem[]>([]);
  const [barTable, setBarTable] = useState('Bar Counter');
  const [happyHour, setHappyHour] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  // Restaurant POS state
  const [restCategory, setRestCategory] = useState('Breakfast');
  const [restCart, setRestCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [kotMode, setKotMode] = useState(false);

  // Room detail dialog
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Guest portal
  const [portalRoom, setPortalRoom] = useState('101');
  const [portalCart, setPortalCart] = useState<CartItem[]>([]);
  const [portalOrders, setPortalOrders] = useState<PortalOrder[]>([]);
  const [portalRequests, setPortalRequests] = useState<PortalServiceRequest[]>([]);
  const [portalMessage, setPortalMessage] = useState<string | null>(null);

  // Live KDS feed (orders + service requests over the /hotel socket).
  const live = useHotelLive();

  // Public tenant settings (slug, name) used by the QR + public guest pages.
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantBrand, setTenantBrand] = useState('');
  const [tenantSaving, setTenantSaving] = useState(false);
  const [kdsStation, setKdsStation] = useState<'all' | 'kitchen' | 'bar' | 'other'>('all');

  // Menu editor — backend-synced menu items the guest portal/POS read from.
  interface MenuItemRow {
    id: string;
    name: string;
    category: string;
    price: number | string;
    currency: string;
    available: boolean;
    station: 'kitchen' | 'bar' | 'other';
  }
  const [menuRows, setMenuRows] = useState<MenuItemRow[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuFilter, setMenuFilter] = useState<'all' | 'kitchen' | 'bar' | 'other'>('all');
  const [menuEditor, setMenuEditor] = useState<null | {
    id?: string;
    name: string;
    category: string;
    price: string;
    currency: string;
    station: 'kitchen' | 'bar' | 'other';
    available: boolean;
  }>(null);
  const [menuSaving, setMenuSaving] = useState(false);

  // Reception
  const [receiptGuest, setReceiptGuest] = useState<Guest | null>(null);

  // Search
  const [searchGuest, setSearchGuest] = useState('');
  const [searchInventory, setSearchInventory] = useState('');

  // Accounting
  const [reportPeriod, setReportPeriod] = useState('daily');

  // ─── Derived Data ──────────────────────────────────────────────────
  const occupiedCount = rooms.filter(r => r.status === 'occupied').length;
  const availableCount = rooms.filter(r => r.status === 'available').length;
  const cleaningCount = rooms.filter(r => r.status === 'cleaning').length;
  const maintenanceCount = rooms.filter(r => r.status === 'maintenance').length;

  const checkedInGuests = guests.filter(g => g.status === 'Checked-in');
  const todayStr = '2024-06-14';
  const todayArrivals = guests.filter(g => g.checkIn === todayStr);
  const todayDepartures = guests.filter(g => g.checkOut === todayStr);
  const pendingCheckouts = checkedInGuests.filter(g => g.checkOut <= todayStr).length;

  const barCategories = useMemo(() => [...new Set(BAR_ITEMS.map(i => i.category))], []);
  const restCategories = useMemo(() => [...new Set(FOOD_ITEMS.map(i => i.category))], []);
  const filteredBarItems = BAR_ITEMS.filter(i => i.category === barCategory);
  const filteredRestItems = FOOD_ITEMS.filter(i => i.category === restCategory);
  const filteredGuests = guests.filter(g => g.name.toLowerCase().includes(searchGuest.toLowerCase()) || g.room.toLowerCase().includes(searchGuest.toLowerCase()));
  const filteredInventory = inventory.filter(i => i.name.toLowerCase().includes(searchInventory.toLowerCase()));

  // ─── Cart Helpers ──────────────────────────────────────────────────
  const addToBarCart = (item: MenuItem) => {
    setBarCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };
  const updateBarQty = (id: number, delta: number) => {
    setBarCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0));
  };
  const removeFromBarCart = (id: number) => setBarCart(prev => prev.filter(c => c.id !== id));
  const barSubtotal = barCart.reduce((s, c) => s + c.price * c.qty, 0);
  const barDiscount = happyHour ? Math.round(barSubtotal * 0.2) : 0;
  const barVAT = Math.round((barSubtotal - barDiscount) * 0.18);
  const barTotal = barSubtotal - barDiscount + barVAT;

  const addToRestCart = (item: MenuItem) => {
    setRestCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };
  const updateRestQty = (id: number, delta: number) => {
    setRestCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0));
  };
  const restSubtotal = restCart.reduce((s, c) => s + c.price * c.qty, 0);
  const restVAT = Math.round(restSubtotal * 0.18);
  const restTotal = restSubtotal + restVAT;

  const addToPortalCart = (item: MenuItem) => {
    setPortalCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };
  const portalTotal = portalCart.reduce((s, c) => s + c.price * c.qty, 0);

  // Load guest-portal orders and service requests from the backend on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await ensureSession(); } catch { /* offline — board stays empty */ }
      if (cancelled) return;
      try {
        const [orders, requests] = await Promise.all([
          api<PortalOrder[]>('/hotel/orders'),
          api<PortalServiceRequest[]>('/hotel/service-requests'),
        ]);
        if (cancelled) return;
        setPortalOrders(Array.isArray(orders) ? orders : []);
        setPortalRequests(Array.isArray(requests) ? requests : []);
      } catch { /* keep empty */ }

      try {
        const t = await api<{ slug?: string; name?: string; brandColor?: string | null } | null>('/hotel/tenant');
        if (cancelled || !t) return;
        if (t.slug) setTenantSlug(t.slug);
        if (t.name) setTenantName(t.name);
        if (t.brandColor) setTenantBrand(t.brandColor);
      } catch { /* tenant not configured yet */ }

      try {
        const items = await api<MenuItemRow[]>('/hotel/menu-items');
        if (!cancelled) setMenuRows(Array.isArray(items) ? items : []);
      } catch { /* no menu yet */ }
      if (!cancelled) setMenuLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const openNewMenuItem = () => setMenuEditor({
    name: '', category: '', price: '', currency: tenantBrand && tenantBrand.length ? 'TZS' : 'TZS',
    station: 'kitchen', available: true,
  });
  const openEditMenuItem = (m: MenuItemRow) => setMenuEditor({
    id: m.id,
    name: m.name,
    category: m.category,
    price: String(m.price),
    currency: m.currency,
    station: m.station,
    available: m.available,
  });

  const saveMenuItem = async () => {
    if (!menuEditor) return;
    const price = parseFloat(menuEditor.price);
    if (!menuEditor.name.trim() || !menuEditor.category.trim() || !Number.isFinite(price) || price < 0) {
      flashPortalMessage('Name, category and a non-negative price are required.');
      return;
    }
    setMenuSaving(true);
    try {
      const payload = {
        name: menuEditor.name.trim(),
        category: menuEditor.category.trim(),
        price,
        currency: menuEditor.currency || 'TZS',
        station: menuEditor.station,
        available: menuEditor.available,
      };
      const saved = menuEditor.id
        ? await api<MenuItemRow>(`/hotel/menu-items/${menuEditor.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await api<MenuItemRow>('/hotel/menu-items', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setMenuRows(prev => {
        const i = prev.findIndex(x => x.id === saved.id);
        if (i === -1) return [saved, ...prev];
        const copy = prev.slice();
        copy[i] = saved;
        return copy;
      });
      setMenuEditor(null);
    } catch (err) {
      flashPortalMessage(`Could not save: ${(err as Error).message}`);
    } finally {
      setMenuSaving(false);
    }
  };

  const deleteMenuItem = async (id: string) => {
    const ok = window.confirm('Remove this menu item? Existing orders are not affected.');
    if (!ok) return;
    try {
      await api(`/hotel/menu-items/${id}`, { method: 'DELETE' });
      setMenuRows(prev => prev.filter(x => x.id !== id));
      if (menuEditor?.id === id) setMenuEditor(null);
    } catch (err) {
      flashPortalMessage(`Could not delete: ${(err as Error).message}`);
    }
  };

  const toggleMenuAvailable = async (m: MenuItemRow) => {
    try {
      const updated = await api<MenuItemRow>(`/hotel/menu-items/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ available: !m.available }),
      });
      setMenuRows(prev => prev.map(x => (x.id === m.id ? updated : x)));
    } catch (err) {
      flashPortalMessage(`Could not update: ${(err as Error).message}`);
    }
  };

  const saveTenant = async () => {
    const slug = tenantSlug.trim().toLowerCase();
    const name = tenantName.trim();
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) || !name) {
      flashPortalMessage('Slug must be 3–40 chars, lowercase, hyphens only.');
      return;
    }
    setTenantSaving(true);
    try {
      await api('/hotel/tenant', {
        method: 'POST',
        body: JSON.stringify({ slug, name, brandColor: tenantBrand || undefined }),
      });
      flashPortalMessage(`Public portal saved: /p/${slug}/…`);
    } catch (err) {
      flashPortalMessage(`Could not save tenant: ${(err as Error).message}`);
    } finally {
      setTenantSaving(false);
    }
  };

  const tenantBaseDomain = import.meta.env.VITE_TENANT_BASE_DOMAIN as string | undefined;
  const publicBaseUrl = () =>
    tenantBaseDomain ? `https://<slug>.${tenantBaseDomain}` : window.location.origin;
  const publicRoomUrl = tenantSlug
    ? buildPublicGuestUrl(tenantSlug, 'room', portalRoom)
    : `${window.location.origin}/p/<slug>/room/${portalRoom}`;

  const flashPortalMessage = (msg: string) => {
    setPortalMessage(msg);
    setTimeout(() => setPortalMessage(curr => (curr === msg ? null : curr)), 4000);
  };

  const placePortalOrder = async () => {
    if (portalCart.length === 0) return;
    try {
      const created = await api<PortalOrder>('/hotel/orders', {
        method: 'POST',
        body: JSON.stringify({
          roomNumber: portalRoom,
          items: portalCart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
          currency: 'TZS',
        }),
      });
      if (created && (created as PortalOrder).id) {
        setPortalOrders(prev => [created, ...prev]);
      }
      setPortalCart([]);
      flashPortalMessage(`Order placed for Room ${portalRoom}. Staff will confirm shortly.`);
    } catch {
      flashPortalMessage('Could not place order — please try again.');
    }
  };

  const requestPortalService = async (kind: string, label: string) => {
    try {
      const created = await api<PortalServiceRequest>('/hotel/service-requests', {
        method: 'POST',
        body: JSON.stringify({ roomNumber: portalRoom, kind, note: '' }),
      });
      if (created && (created as PortalServiceRequest).id) {
        setPortalRequests(prev => [created, ...prev]);
      }
      flashPortalMessage(`${label} requested for Room ${portalRoom}.`);
    } catch {
      flashPortalMessage('Could not submit request — please try again.');
    }
  };

  // ─── Check-in handler ──────────────────────────────────────────────
  const handleCheckIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const roomNum = formData.get('room') as string;
    const newGuest: Guest = {
      id: Date.now(),
      name: formData.get('name') as string,
      room: roomNum,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      idNumber: formData.get('idNumber') as string,
      nationality: formData.get('nationality') as string,
      checkIn: formData.get('checkIn') as string,
      checkOut: formData.get('checkOut') as string,
      status: 'Checked-in',
      guests: Number(formData.get('guests')),
      paymentMethod: formData.get('paymentMethod') as string,
      balance: 0,
    };
    setGuests(prev => [...prev, newGuest]);
    setRooms(prev => prev.map(r => r.number === roomNum ? { ...r, status: 'occupied', guest: newGuest.name } as Room : r));
    form.reset();
  };

  const handleCheckout = (guestId: number) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, status: 'Checked-out' } : g));
    setRooms(prev => prev.map(r => r.number === guest.room ? { ...r, status: 'cleaning', guest: undefined } as Room : r));
    setReceiptGuest(guest);
  };

  const toggleStaffStatus = (staffId: number) => {
    setStaff(prev => prev.map(s => {
      if (s.id !== staffId) return s;
      const next = s.status === 'On Duty' ? 'Off' : s.status === 'Off' ? 'On Leave' : 'On Duty';
      return { ...s, status: next as StaffMember['status'] };
    }));
  };

  // ─── Sidebar Items ─────────────────────────────────────────────────
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    { id: 'reception', label: 'Reception', icon: ConciergeBell, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { id: 'rooms', label: 'Rooms', icon: Bed, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'bar', label: 'Bar POS', icon: Wine, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { id: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { id: 'food', label: 'Food List', icon: CakeSlice, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    { id: 'inventory', label: 'Inventory', icon: Package, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    { id: 'staff', label: 'Staff', icon: Users, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    { id: 'accounting', label: 'Accounting', icon: Calculator, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
    { id: 'menu', label: 'Menu', icon: CakeSlice, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    { id: 'kds', label: 'KDS', icon: ChefHat, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { id: 'portal', label: 'Guest Portal', icon: QrCode, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
    { id: 'channels', label: 'Channels', icon: Globe2, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
    { id: 'inbox', label: 'Inbox', icon: MessageSquare, color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20' },
    { id: 'erp', label: 'Hotel ERP', icon: LayoutDashboard, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    { id: 'qr-portal', label: 'QR Portal', icon: QrCode, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  ];

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className={`flex h-full w-full overflow-hidden ${darkMode ? 'bg-[#0a0a1a] text-white' : 'bg-gray-50 text-gray-900'}`}>

      {/* ─── SIDEBAR ──────────────────────────────────────────────── */}
      <aside className={`w-20 flex-shrink-0 flex flex-col items-center py-4 ${darkMode ? 'bg-[#0c0c1a] border-r border-white/[0.06]' : 'bg-white border-r border-gray-200'}`}>
        <div className="mb-3 flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-[8px] font-bold tracking-tight text-cyan-400">KOBE</span>
        </div>
        <div className="flex-1 overflow-y-auto w-full px-2">
          <div className="flex flex-col items-center gap-2 pb-2">
            {sidebarItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 border ${isActive ? `${item.color} scale-105 shadow-lg` : darkMode ? 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[7px] font-medium leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="pt-2">
          <button onClick={() => setDarkMode(!darkMode)} className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'text-amber-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto p-6">

        {/* ════════════════════════════════════════════════════════════
            DASHBOARD
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && <HotelBookersDashboard />}

        {/* ════════════════════════════════════════════════════════════
            RECEPTION
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'reception' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Reception</h1>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input placeholder="Search guests..." className={`pl-9 w-64 ${darkMode ? 'bg-[#13131f] border-white/10' : ''}`} value={searchGuest} onChange={e => setSearchGuest(e.target.value)} />
              </div>
            </div>

            <Tabs defaultValue="checkin" className="w-full">
              <TabsList className={darkMode ? 'bg-[#13131f] border border-white/[0.06]' : ''}>
                <TabsTrigger value="checkin">Check-in</TabsTrigger>
                <TabsTrigger value="guests">Guest List ({filteredGuests.length})</TabsTrigger>
                <TabsTrigger value="arrivals">Today's Arrivals ({todayArrivals.length})</TabsTrigger>
                <TabsTrigger value="departures">Departures ({todayDepartures.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="checkin" className="mt-4">
                <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-400" />New Check-in</h3>
                    <form onSubmit={handleCheckIn} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input name="name" placeholder="Guest Full Name" required className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''} />
                      <Input name="phone" placeholder="Phone Number" required className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''} />
                      <Input name="email" type="email" placeholder="Email" className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''} />
                      <Input name="idNumber" placeholder="ID/Passport Number" required className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''} />
                      <Input name="nationality" placeholder="Nationality" required className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''} />
                      <Input name="guests" type="number" min={1} placeholder="Number of Guests" required className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''} />
                      <Input name="checkIn" type="date" required className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''} />
                      <Input name="checkOut" type="date" required className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''} />
                      <Select name="room">
                        <SelectTrigger className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''}>
                          <SelectValue placeholder="Select Room" />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.filter(r => r.status === 'available').map(r => (
                            <SelectItem key={r.id} value={r.number}>{r.number} - {r.type} (TZS {r.price.toLocaleString()})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select name="paymentMethod">
                        <SelectTrigger className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''}>
                          <SelectValue placeholder="Payment Method" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Cash', 'M-Pesa', 'Card', 'Bank Transfer'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input name="amount" type="number" placeholder="Amount Paid (TZS)" className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''} />
                      <Button type="submit" className="md:col-span-3 bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="w-4 h-4 mr-2" />Complete Check-in
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="guests" className="mt-4">
                <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                  <CardContent className="p-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className={`text-left ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs uppercase`}>
                        <th className="pb-3 pr-4">Name</th><th className="pb-3 pr-4">Room</th><th className="pb-3 pr-4">Check-in</th>
                        <th className="pb-3 pr-4">Check-out</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Phone</th>
                        <th className="pb-3 pr-4">Balance</th><th className="pb-3">Actions</th>
                      </tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredGuests.map(g => (
                          <tr key={g.id} className="group">
                            <td className="py-3 pr-4 font-medium">{g.name}</td>
                            <td className="py-3 pr-4">{g.room}</td>
                            <td className="py-3 pr-4">{g.checkIn}</td>
                            <td className="py-3 pr-4">{g.checkOut}</td>
                            <td className="py-3 pr-4">{statusBadge(g.status)}</td>
                            <td className="py-3 pr-4">{g.phone}</td>
                            <td className="py-3 pr-4 text-amber-400">{g.balance > 0 ? `TZS ${g.balance.toLocaleString()}` : 'Paid'}</td>
                            <td className="py-3">
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedRoom(rooms.find(r => r.number === g.room) || null)}><Eye className="w-3 h-3" /></Button>
                                {g.status === 'Checked-in' && (
                                  <>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => handleCheckout(g.id)}><Check className="w-3 h-3" /></Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Printer className="w-3 h-3" /></Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="arrivals" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todayArrivals.map(g => (
                    <Card key={g.id} className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center"><User className="w-4 h-4 text-blue-400" /></div>
                          <div><p className="font-medium text-sm">{g.name}</p><p className="text-xs text-gray-400">{g.nationality}</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-3">
                          <span><Phone className="w-3 h-3 inline mr-1" />{g.phone}</span>
                          <span><Calendar className="w-3 h-3 inline mr-1" />{g.checkOut}</span>
                        </div>
                        {statusBadge(g.status)}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="departures" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todayDepartures.map(g => (
                    <Card key={g.id} className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center"><User className="w-4 h-4 text-red-400" /></div>
                            <div><p className="font-medium text-sm">{g.name}</p><p className="text-xs text-gray-400">Room {g.room}</p></div>
                          </div>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleCheckout(g.id)}>
                            <Check className="w-3 h-3 mr-1" />Checkout
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            ROOMS (blue/light board view)
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'rooms' && (
          <RoomsBoard rooms={rooms} onSelect={(r) => setSelectedRoom(r as Room)} />
        )}

        {/* ════════════════════════════════════════════════════════════
            FOOD LIST (customer-facing menu catalog)
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'food' && (
          <FoodListBoard />
        )}

        {/* ════════════════════════════════════════════════════════════
            BAR POS
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'bar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold">Bar POS</h1><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Point of Sale System</p></div>
              <div className="flex gap-2 items-center">
                <Select value={barTable} onValueChange={setBarTable}>
                  <SelectTrigger className={`w-40 ${darkMode ? 'bg-[#13131f] border-white/10' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bar Counter">Bar Counter</SelectItem>
                    {Array.from({ length: 8 }, (_, i) => <SelectItem key={i} value={`Table ${i + 1}`}>Table {i + 1}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant={happyHour ? 'default' : 'outline'} className={happyHour ? 'bg-pink-600' : darkMode ? 'border-white/10' : ''} onClick={() => setHappyHour(!happyHour)}>
                  <Wine className="w-4 h-4 mr-1" />Happy Hour
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-220px)]">
              {/* Categories */}
              <div className="space-y-2">
                {barCategories.map(cat => (
                  <Button key={cat} variant={barCategory === cat ? 'default' : 'outline'} className={`w-full justify-start ${barCategory === cat ? 'bg-amber-600' : darkMode ? 'border-white/10 hover:bg-white/5' : ''}`} onClick={() => setBarCategory(cat)}>
                    <GlassWater className="w-4 h-4 mr-2" />{cat}
                  </Button>
                ))}
              </div>

              {/* Items Grid */}
              <div className="lg:col-span-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredBarItems.map(item => {
                    const price = happyHour ? Math.round(item.price * 0.8) : item.price;
                    return (
                      <button key={item.id} onClick={() => addToBarCart(item)} className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.03] ${darkMode ? 'bg-[#13131f] border-white/[0.06] hover:border-amber-500/30' : 'bg-white border-gray-200 hover:border-amber-400'}`}>
                        <p className="font-medium text-sm">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {happyHour && <span className="text-xs line-through text-gray-500">TZS {item.price.toLocaleString()}</span>}
                          <span className="text-sm font-bold text-amber-400">TZS {price.toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Stock: {item.stock}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cart */}
              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'} flex flex-col`}>
                <CardContent className="p-4 flex flex-col h-full">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Receipt className="w-4 h-4" />Order - {barTable}</h3>
                  <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                    {barCart.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Cart is empty</p>}
                    {barCart.map(item => {
                      const price = happyHour ? Math.round(item.price * 0.8) : item.price;
                      return (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{item.name}</p><p className="text-[10px] text-gray-400">TZS {price.toLocaleString()}</p></div>
                          <div className="flex items-center gap-2 ml-2">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => updateBarQty(item.id, -1)}><Minus className="w-3 h-3" /></Button>
                            <span className="text-xs w-4 text-center">{item.qty}</span>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => updateBarQty(item.id, 1)}><Plus className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400" onClick={() => removeFromBarCart(item.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-white/10 pt-3 mt-3 space-y-1 text-sm">
                    {happyHour && <div className="flex justify-between text-pink-400"><span>Happy Hour (-20%)</span><span>-{formatTZS(barDiscount)}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>{formatTZS(barSubtotal - barDiscount)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">VAT (18%)</span><span>{formatTZS(barVAT)}</span></div>
                    <div className="flex justify-between text-lg font-bold pt-1 border-t border-white/10"><span>Total</span><span className="text-amber-400">{formatTZS(barTotal)}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''} onClick={() => setBarCart([])}><X className="w-3 h-3 mr-1" />Clear</Button>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => barCart.length > 0 && setShowReceipt(true)}><Check className="w-3 h-3 mr-1" />Pay</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''}><Banknote className="w-3 h-3 mr-1" />Cash</Button>
                    <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''}><Smartphone className="w-3 h-3 mr-1" />M-Pesa</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            RESTAURANT POS
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'restaurant' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold">Restaurant</h1><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Table Management & POS</p></div>
              <div className="flex gap-2">
                <Button size="sm" variant={kotMode ? 'default' : 'outline'} className={kotMode ? 'bg-orange-600' : darkMode ? 'border-white/10' : ''} onClick={() => setKotMode(!kotMode)}>
                  <ChefHat className="w-4 h-4 mr-1" />Kitchen Display
                </Button>
              </div>
            </div>

            {!kotMode ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Tables */}
                <div className="lg:col-span-4 mb-2">
                  <h3 className="text-sm font-semibold mb-3">Table Layout</h3>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                    {RESTAURANT_TABLES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTable(t.id)}
                        className={`p-3 rounded-xl border text-center transition-all hover:scale-105 ${
                          selectedTable === t.id ? 'ring-2 ring-orange-500 ' : ''
                        }${
                          t.status === 'available' ? 'border-emerald-500/30 bg-emerald-500/10' :
                          t.status === 'occupied' ? 'border-red-500/30 bg-red-500/10' :
                          'border-amber-500/30 bg-amber-500/10'
                        }`}
                      >
                        <p className="text-xs font-bold">T{t.id}</p>
                        <p className="text-[10px] text-gray-400">{t.seats} seats</p>
                        {t.guest && <p className="text-[9px] text-gray-500 truncate mt-1">{t.guest}</p>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div className="space-y-2">
                  {restCategories.map(cat => (
                    <Button key={cat} variant={restCategory === cat ? 'default' : 'outline'} className={`w-full justify-start ${restCategory === cat ? 'bg-orange-600' : darkMode ? 'border-white/10 hover:bg-white/5' : ''}`} onClick={() => setRestCategory(cat)}>
                      {cat === 'Breakfast' && <Coffee className="w-4 h-4 mr-2" />}
                      {cat === 'Lunch' && <Beef className="w-4 h-4 mr-2" />}
                      {cat === 'Dinner' && <UtensilsCrossed className="w-4 h-4 mr-2" />}
                      {cat === 'Swahili' && <Star className="w-4 h-4 mr-2" />}
                      {cat === 'Drinks' && <GlassWater className="w-4 h-4 mr-2" />}
                      {cat === 'Desserts' && <CakeSlice className="w-4 h-4 mr-2" />}
                      {cat}
                    </Button>
                  ))}
                </div>

                {/* Food Items */}
                <div className="lg:col-span-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredRestItems.map(item => (
                      <button key={item.id} onClick={() => addToRestCart(item)} className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.03] ${darkMode ? 'bg-[#13131f] border-white/[0.06] hover:border-orange-500/30' : 'bg-white border-gray-200 hover:border-orange-400'}`}>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-sm font-bold text-orange-400 mt-1">TZS {item.price.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500">Stock: {item.stock}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cart */}
                <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'} flex flex-col`}>
                  <CardContent className="p-4 flex flex-col h-full">
                    <h3 className="font-semibold mb-3 flex items-center gap-2"><Receipt className="w-4 h-4" />{selectedTable ? `Table ${selectedTable}` : 'Select Table'}</h3>
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                      {restCart.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Cart is empty</p>}
                      {restCart.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{item.name}</p><p className="text-[10px] text-gray-400">TZS {item.price.toLocaleString()}</p></div>
                          <div className="flex items-center gap-2 ml-2">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => updateRestQty(item.id, -1)}><Minus className="w-3 h-3" /></Button>
                            <span className="text-xs w-4 text-center">{item.qty}</span>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => updateRestQty(item.id, 1)}><Plus className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-white/10 pt-3 mt-3 space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>{formatTZS(restSubtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">VAT (18%)</span><span>{formatTZS(restVAT)}</span></div>
                      <div className="flex justify-between text-lg font-bold pt-1 border-t border-white/10"><span>Total</span><span className="text-orange-400">{formatTZS(restTotal)}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''} onClick={() => setRestCart([])}><X className="w-3 h-3 mr-1" />Clear</Button>
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => restCart.length > 0 && setKotMode(true)}><Send className="w-3 h-3 mr-1" />Send KOT</Button>
                    </div>
                    <Button size="sm" variant="outline" className={`mt-2 w-full ${darkMode ? 'border-white/10' : ''}`}><Bed className="w-3 h-3 mr-1" />Room Charge</Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Kitchen Display */
              <div>
                <Button size="sm" variant="outline" className={`mb-4 ${darkMode ? 'border-white/10' : ''}`} onClick={() => setKotMode(false)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />Back to POS
                </Button>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {['Pending', 'Preparing', 'Ready'].map((status, idx) => (
                    <div key={status}>
                      <h3 className={`text-sm font-semibold mb-3 ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-blue-400' : 'text-emerald-400'}`}>{status}</h3>
                      <div className="space-y-3">
                        {restCart.length > 0 && status === 'Pending' && (
                          <Card className={`${darkMode ? 'bg-[#13131f] border-amber-500/30' : 'bg-white border-amber-300'}`}>
                            <CardContent className="p-3">
                              <p className="text-xs font-bold mb-2">Table {selectedTable || '?'}</p>
                              {restCart.map(item => (
                                <p key={item.id} className="text-xs">{item.qty}x {item.name}</p>
                              ))}
                              <p className="text-xs text-gray-400 mt-2">{new Date().toLocaleTimeString()}</p>
                            </CardContent>
                          </Card>
                        )}
                        {idx === 1 && (
                          <Card className={`${darkMode ? 'bg-[#13131f] border-blue-500/30' : 'bg-white border-blue-300'}`}>
                            <CardContent className="p-3">
                              <p className="text-xs font-bold mb-2">Table 2</p>
                              <p className="text-xs">2x Grilled Chicken</p>
                              <p className="text-xs">1x Pasta Carbonara</p>
                              <p className="text-xs text-gray-400 mt-2">Chef Hassan - 12:30 PM</p>
                            </CardContent>
                          </Card>
                        )}
                        {idx === 2 && (
                          <Card className={`${darkMode ? 'bg-[#13131f] border-emerald-500/30' : 'bg-white border-emerald-300'}`}>
                            <CardContent className="p-3">
                              <p className="text-xs font-bold mb-2">Table 4</p>
                              <p className="text-xs">1x Seafood Platter</p>
                              <p className="text-xs">2x Red Wine</p>
                              <Button size="sm" className="mt-2 w-full bg-emerald-600 h-7 text-xs"><Check className="w-3 h-3 mr-1" />Mark Served</Button>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            INVENTORY
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold">Inventory</h1><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Stock Management</p></div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input placeholder="Search items..." className={`pl-9 w-64 ${darkMode ? 'bg-[#13131f] border-white/10' : ''}`} value={searchInventory} onChange={e => setSearchInventory(e.target.value)} />
              </div>
            </div>

            {/* Category Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Bar Stock', count: inventory.filter(i => i.category === 'Bar Stock').length, icon: Wine, alert: inventory.filter(i => i.category === 'Bar Stock' && (i.status === 'Low' || i.status === 'Out')).length },
                { label: 'Food Ingredients', count: inventory.filter(i => i.category === 'Food Ingredients').length, icon: ChefHat, alert: inventory.filter(i => i.category === 'Food Ingredients' && (i.status === 'Low' || i.status === 'Out')).length },
                { label: 'Cleaning Supplies', count: inventory.filter(i => i.category === 'Cleaning Supplies').length, icon: Brush, alert: 0 },
                { label: 'Room Amenities', count: inventory.filter(i => i.category === 'Room Amenities').length, icon: Bed, alert: 0 },
              ].map(cat => {
                const Icon = cat.icon;
                return (
                  <Card key={cat.label} className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center"><Icon className="w-5 h-5 text-violet-400" /></div>
                          <div><p className="font-semibold text-sm">{cat.label}</p><p className="text-xs text-gray-400">{cat.count} items</p></div>
                        </div>
                        {cat.alert > 0 && <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">{cat.alert} Alert{cat.alert > 1 ? 's' : ''}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Inventory Table */}
            <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
              <CardContent className="p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className={`text-left ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs uppercase`}>
                    <th className="pb-3 pr-4">Item</th><th className="pb-3 pr-4">Category</th><th className="pb-3 pr-4">Stock</th>
                    <th className="pb-3 pr-4">Min Threshold</th><th className="pb-3 pr-4">Status</th><th className="pb-3">Last Restocked</th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredInventory.map(item => (
                      <tr key={item.id} className={`${item.status === 'Low' || item.status === 'Out' ? 'bg-red-500/5' : ''}`}>
                        <td className="py-3 pr-4 font-medium">{item.name}</td>
                        <td className="py-3 pr-4 text-xs text-gray-400">{item.category}</td>
                        <td className="py-3 pr-4">{item.quantity} {item.unit}</td>
                        <td className="py-3 pr-4 text-xs text-gray-400">{item.minThreshold} {item.unit}</td>
                        <td className="py-3 pr-4">{statusBadge(item.status)}</td>
                        <td className="py-3 text-xs text-gray-400">{item.lastRestocked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card className={`${darkMode ? 'bg-[#13131f] border-red-500/20' : 'bg-white border-red-200'}`}>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-400"><AlertTriangle className="w-4 h-4" />Low Stock Alerts</h3>
                <div className="space-y-2">
                  {inventory.filter(i => i.status === 'Low' || i.status === 'Out').map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-red-500/5">
                      <span className="text-sm">{item.name} - {item.quantity} {item.unit} remaining (min: {item.minThreshold})</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"><Plus className="w-3 h-3 mr-1" />Order</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            STAFF
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold">Staff</h1><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{staff.filter(s => s.status === 'On Duty').length} on duty</p></div>
            </div>

            <Tabs defaultValue="team" className="w-full">
              <TabsList className={darkMode ? 'bg-[#13131f] border border-white/[0.06]' : ''}>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="team" className="mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {staff.map(s => (
                    <Card key={s.id} className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${s.status === 'On Duty' ? 'bg-emerald-500/20 text-emerald-400' : s.status === 'Off' ? 'bg-slate-500/20 text-slate-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {s.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.role}</p>
                          </div>
                        </div>
                        <div className="space-y-1 text-xs text-gray-400 mb-3">
                          <p><Clock className="w-3 h-3 inline mr-1" />{s.shift}</p>
                          <p><Phone className="w-3 h-3 inline mr-1" />{s.phone}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          {statusBadge(s.status)}
                          <Button size="sm" variant="outline" className={`h-7 text-xs ${darkMode ? 'border-white/10' : ''}`} onClick={() => toggleStaffStatus(s.id)}>
                            {s.status === 'On Duty' ? 'Clock Out' : 'Clock In'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="mt-4">
                <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                  <CardContent className="p-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className={`text-left ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>
                        <th className="pb-3 pr-4">Staff</th><th className="pb-3 pr-4">Mon</th><th className="pb-3 pr-4">Tue</th>
                        <th className="pb-3 pr-4">Wed</th><th className="pb-3 pr-4">Thu</th><th className="pb-3 pr-4">Fri</th>
                        <th className="pb-3 pr-4">Sat</th><th className="pb-3">Sun</th>
                      </tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {staff.slice(0, 8).map(s => (
                          <tr key={s.id}>
                            <td className="py-2 pr-4 font-medium text-xs">{s.name}</td>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                              <td key={d} className="py-2 pr-4"><div className={`w-6 h-6 rounded-full ${Math.random() > 0.3 ? 'bg-emerald-500/30' : 'bg-slate-500/20'}`} /></td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="performance" className="mt-4">
                <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Sales per Staff Member</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={staff.filter(s => (s.sales || 0) > 0)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#333' : '#eee'} />
                        <XAxis type="number" tick={{ fill: darkMode ? '#888' : '#666', fontSize: 12 }} tickFormatter={v => `${v / 1000}K`} />
                        <YAxis dataKey="name" type="category" tick={{ fill: darkMode ? '#888' : '#666', fontSize: 11 }} width={100} />
                        <Tooltip contentStyle={{ background: darkMode ? '#1a1a2e' : '#fff', border: darkMode ? '1px solid #333' : '1px solid #eee', borderRadius: 8 }} formatter={(value: number) => formatTZS(value)} />
                        <Bar dataKey="sales" fill={COLORS.sky} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            ACCOUNTING
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'accounting' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold">Accounting</h1><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Financial Reports</p></div>
              <div className="flex gap-2">
                <Select value={reportPeriod} onValueChange={setReportPeriod}>
                  <SelectTrigger className={`w-32 ${darkMode ? 'bg-[#13131f] border-white/10' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''}><Download className="w-4 h-4 mr-1" />Export</Button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Sales', value: formatTZS(1130000), icon: CircleDollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Expenses', value: formatTZS(5300000), icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10' },
                { label: 'Net Profit', value: formatTZS(1420000), icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                { label: 'VAT (18%)', value: formatTZS(203400), icon: Calculator, color: 'text-violet-400', bg: 'bg-violet-500/10' },
              ].map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                  <Card key={i} className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                    <CardContent className="p-4">
                      <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}><Icon className={`w-4 h-4 ${kpi.color}`} /></div>
                      <p className="text-xl font-bold">{kpi.value}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Revenue Pie + Expenses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Revenue Breakdown</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={REVENUE_PIE} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {REVENUE_PIE.map((_, index) => <Cell key={index} fill={PIE_COLORS[index]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: darkMode ? '#1a1a2e' : '#fff', border: darkMode ? '1px solid #333' : '1px solid #eee', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2">
                    {REVENUE_PIE.map((entry, index) => (
                      <span key={entry.name} className="text-xs flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[index] }} />{entry.name} {entry.value}%</span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Expense Breakdown</h3>
                  <div className="space-y-4">
                    {EXPENSE_DATA.map(exp => (
                      <div key={exp.category}>
                        <div className="flex justify-between text-sm mb-1"><span>{exp.category}</span><span>{formatTZS(exp.amount)}</span></div>
                        <div className={`h-2 rounded-full ${darkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                          <div className="h-2 rounded-full bg-red-500/60 transition-all" style={{ width: `${(exp.amount / 2800000) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Shift Closing */}
            <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Shift Closing</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Opening Float', value: 'TZS 100,000' },
                    { label: 'Cash Sales', value: 'TZS 450,000' },
                    { label: 'M-Pesa Sales', value: 'TZS 380,000' },
                    { label: 'Card Sales', value: 'TZS 300,000' },
                  ].map(item => (
                    <div key={item.label} className={`p-3 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className="text-sm font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
                <Button className="bg-green-600 hover:bg-green-700"><Lock className="w-4 h-4 mr-2" />Close Shift</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            GUEST PORTAL (QR)
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'portal' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold">Guest Portal</h1><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>QR Code & Digital Services</p></div>
              <Select value={portalRoom} onValueChange={setPortalRoom}>
                <SelectTrigger className={`w-40 ${darkMode ? 'bg-[#13131f] border-white/10' : ''}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rooms.filter(r => r.status === 'occupied').map(r => <SelectItem key={r.id} value={r.number}>{r.number} - {r.guest}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Public Portal Settings</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Set your hotel's public slug. QR codes then resolve to
                  <code className="ml-1">{publicBaseUrl()}/p/&lt;slug&gt;/room/&lt;n&gt;</code> with no login.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Slug</label>
                    <Input
                      value={tenantSlug}
                      onChange={e => setTenantSlug(e.target.value)}
                      placeholder="serenahotel"
                      className={darkMode ? 'bg-[#0a0a1a] border-white/10 text-white placeholder:text-gray-600' : ''}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-400 mb-1 block">Display name</label>
                    <Input
                      value={tenantName}
                      onChange={e => setTenantName(e.target.value)}
                      placeholder="Serena Hotel"
                      className={darkMode ? 'bg-[#0a0a1a] border-white/10 text-white placeholder:text-gray-600' : ''}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Brand color</label>
                    <Input
                      value={tenantBrand}
                      onChange={e => setTenantBrand(e.target.value)}
                      placeholder="#ec4899"
                      className={darkMode ? 'bg-[#0a0a1a] border-white/10 text-white placeholder:text-gray-600' : ''}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-gray-500 truncate mr-2">
                    Current public URL: <span className="text-pink-400">{publicRoomUrl}</span>
                  </p>
                  <Button size="sm" onClick={saveTenant} disabled={tenantSaving} className="bg-pink-600 hover:bg-pink-700 shrink-0">
                    {tenantSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* QR Code */}
              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-6 flex flex-col items-center">
                  <h3 className="font-semibold mb-4">Room {portalRoom} QR Code</h3>
                  <div className="bg-white p-4 rounded-xl">
                    <QRCodeSVG value={publicRoomUrl} size={160} />
                  </div>
                  <p className="text-xs text-gray-400 mt-3 text-center break-all px-2">
                    {tenantSlug ? publicRoomUrl : 'Set a public slug below to make this QR live.'}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!tenantSlug}
                      className={darkMode ? 'border-white/10' : ''}
                      onClick={() => {
                        const q = new URLSearchParams({
                          slug: tenantSlug,
                          type: 'room',
                          n: portalRoom,
                          name: tenantName || tenantSlug,
                          brand: tenantBrand || '#ec4899',
                        });
                        window.open(`/print/qr-card?${q.toString()}`, '_blank', 'noopener');
                      }}
                    >
                      <Printer className="w-4 h-4 mr-1" />Print
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!tenantSlug}
                      className={darkMode ? 'border-white/10' : ''}
                      onClick={() => {
                        const q = new URLSearchParams({
                          slug: tenantSlug,
                          type: 'room',
                          n: portalRoom,
                          name: tenantName || tenantSlug,
                          brand: tenantBrand || '#ec4899',
                        });
                        // Same page — user picks "Save as PDF" from the print dialog.
                        window.open(`/print/qr-card?${q.toString()}`, '_blank', 'noopener');
                      }}
                    >
                      <Download className="w-4 h-4 mr-1" />Download
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Digital Menu */}
              <Card className={`lg:col-span-2 ${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Room Service Menu</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                    {restCategories.map(cat => (
                      <Button key={cat} size="sm" variant="outline" className={`text-xs ${darkMode ? 'border-white/10' : ''}`}>
                        {cat}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FOOD_ITEMS.slice(0, 9).map(item => (
                      <button key={item.id} onClick={() => addToPortalCart(item)} className={`p-2 rounded-lg border text-left text-xs transition-all hover:scale-[1.03] ${darkMode ? 'border-white/[0.06] hover:border-pink-500/30' : 'border-gray-200 hover:border-pink-300'}`}>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-pink-400 font-bold">TZS {item.price.toLocaleString()}</p>
                      </button>
                    ))}
                  </div>
                  {portalCart.length > 0 && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <h4 className="text-sm font-semibold mb-2">Your Order</h4>
                      {portalCart.map(item => (
                        <div key={item.id} className="flex justify-between text-xs py-1"><span>{item.qty}x {item.name}</span><span>TZS {(item.price * item.qty).toLocaleString()}</span></div>
                      ))}
                      <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-white/10">
                        <span>Total</span><span className="text-pink-400">{formatTZS(portalTotal)}</span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={placePortalOrder} disabled={portalCart.length === 0} className="flex-1 bg-pink-600 hover:bg-pink-700"><Send className="w-3 h-3 mr-1" />Place Order</Button>
                        <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''}><Smartphone className="w-3 h-3 mr-1" />M-Pesa</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {portalMessage && (
              <div className="rounded-lg border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-sm text-pink-200">
                {portalMessage}
              </div>
            )}

            {/* Services */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Housekeeping', icon: Brush, desc: 'Request cleaning', kind: 'HOUSEKEEPING' },
                { label: 'Extra Towels', icon: Bed, desc: 'Fresh towels', kind: 'TOWELS' },
                { label: 'Wake-up Call', icon: Clock, desc: 'Set alarm', kind: 'WAKE_UP' },
                { label: 'Extend Stay', icon: Calendar, desc: 'Add nights', kind: 'EXTEND_STAY' },
                { label: 'Checkout', icon: CheckCircle2, desc: 'Early checkout', kind: 'CHECKOUT' },
              ].map(svc => {
                const Icon = svc.icon;
                return (
                  <button
                    key={svc.label}
                    type="button"
                    onClick={() => requestPortalService(svc.kind, svc.label)}
                    className="text-left"
                  >
                    <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'} hover:border-pink-500/30 transition-all cursor-pointer`}>
                      <CardContent className="p-4 text-center">
                        <Icon className="w-6 h-6 mx-auto mb-2 text-pink-400" />
                        <p className="text-sm font-medium">{svc.label}</p>
                        <p className="text-xs text-gray-400">{svc.desc}</p>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>

            {/* Activity for this room */}
            <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Activity — Room {portalRoom}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-pink-400">Orders</h4>
                    <div className="space-y-1.5">
                      {portalOrders.filter(o => o.roomNumber === portalRoom).length === 0 && (
                        <p className="text-xs text-gray-500">No orders yet.</p>
                      )}
                      {portalOrders
                        .filter(o => o.roomNumber === portalRoom)
                        .slice(0, 8)
                        .map(o => (
                          <div key={o.id} className="flex items-center justify-between text-xs py-1">
                            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                              {o.items.map(i => `${i.qty}× ${i.name}`).join(', ') || '—'}
                            </span>
                            <span className="text-gray-400 ml-2 shrink-0">{o.status}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-pink-400">Service Requests</h4>
                    <div className="space-y-1.5">
                      {portalRequests.filter(r => r.roomNumber === portalRoom).length === 0 && (
                        <p className="text-xs text-gray-500">No requests yet.</p>
                      )}
                      {portalRequests
                        .filter(r => r.roomNumber === portalRoom)
                        .slice(0, 8)
                        .map(r => (
                          <div key={r.id} className="flex items-center justify-between text-xs py-1">
                            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                              {r.kind.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                            <span className="text-gray-400 ml-2 shrink-0">{r.status}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bill Viewer */}
            <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Current Bill - Room {portalRoom}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Room charges (3 nights)</span><span>TZS 105,000</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Room service</span><span>TZS 12,500</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Restaurant</span><span>TZS 28,000</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Bar</span><span>TZS 15,500</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">VAT (18%)</span><span>TZS 28,980</span></div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10"><span>Total Due</span><span className="text-pink-400">TZS 189,980</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            CHANNELS (OTA integrations)
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'channels' && <ChannelsTab darkMode={darkMode} />}

        {/* ════════════════════════════════════════════════════════════
            INBOX (guest messaging)
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'inbox' && <GuestInboxTab darkMode={darkMode} />}

        {/* ════════════════════════════════════════════════════════════
            MENU EDITOR
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold">Menu</h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Drives the guest portal, KDS routing, and POS
                </p>
              </div>
              <Button onClick={openNewMenuItem} className="bg-rose-600 hover:bg-rose-700">
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>

            <div className="flex gap-2">
              {(['all', 'kitchen', 'bar', 'other'] as const).map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={menuFilter === s ? 'default' : 'outline'}
                  onClick={() => setMenuFilter(s)}
                  className={menuFilter === s ? 'bg-rose-600 hover:bg-rose-700' : (darkMode ? 'border-white/10' : '')}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                  <span className="ml-1.5 text-xs opacity-60">
                    {s === 'all' ? menuRows.length : menuRows.filter(m => m.station === s).length}
                  </span>
                </Button>
              ))}
            </div>

            <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
              <CardContent className="p-0">
                {menuLoading ? (
                  <div className="p-8 text-center text-sm text-gray-500">Loading menu…</div>
                ) : menuRows.length === 0 ? (
                  <div className="p-12 text-center">
                    <CakeSlice className="w-10 h-10 mx-auto text-rose-400 mb-2 opacity-70" />
                    <p className="text-sm text-gray-400">No menu items yet.</p>
                    <Button size="sm" className="mt-3 bg-rose-600 hover:bg-rose-700" onClick={openNewMenuItem}>
                      <Plus className="w-4 h-4 mr-1" /> Add your first item
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {menuRows
                      .filter(m => menuFilter === 'all' || m.station === menuFilter)
                      .map(m => (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate">{m.name}</p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{m.station}</Badge>
                              {!m.available && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-400 border-amber-400/40">
                                  Hidden
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{m.category}</p>
                          </div>
                          <div className="text-sm font-semibold text-rose-400 w-32 text-right">
                            {Number(m.price).toLocaleString()} {m.currency}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 ${darkMode ? 'border-white/10' : ''}`}
                            onClick={() => toggleMenuAvailable(m)}
                          >
                            {m.available ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="sm" variant="outline" className={`h-8 ${darkMode ? 'border-white/10' : ''}`} onClick={() => openEditMenuItem(m)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-red-500/40 text-red-400 hover:bg-red-500/10"
                            onClick={() => deleteMenuItem(m.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={!!menuEditor} onOpenChange={(o) => !o && setMenuEditor(null)}>
          <DialogContent className={`${darkMode ? 'bg-[#13131f] border-white/[0.06] text-white' : ''} max-w-md`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CakeSlice className="w-4 h-4 text-rose-400" />
                {menuEditor?.id ? 'Edit Menu Item' : 'New Menu Item'}
              </DialogTitle>
            </DialogHeader>
            {menuEditor && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Name</label>
                  <Input
                    value={menuEditor.name}
                    onChange={e => setMenuEditor({ ...menuEditor, name: e.target.value })}
                    placeholder="Cheeseburger"
                    className={darkMode ? 'bg-[#0a0a1a] border-white/10 text-white placeholder:text-gray-600' : ''}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Category</label>
                  <Input
                    list="menu-category-suggestions"
                    value={menuEditor.category}
                    onChange={e => setMenuEditor({ ...menuEditor, category: e.target.value })}
                    placeholder="Mains, Drinks, Desserts…"
                    className={darkMode ? 'bg-[#0a0a1a] border-white/10 text-white placeholder:text-gray-600' : ''}
                  />
                  <datalist id="menu-category-suggestions">
                    {Array.from(new Set(menuRows.map(m => m.category))).map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={menuEditor.price}
                      onChange={e => setMenuEditor({ ...menuEditor, price: e.target.value })}
                      placeholder="15000"
                      className={darkMode ? 'bg-[#0a0a1a] border-white/10 text-white placeholder:text-gray-600' : ''}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Currency</label>
                    <Input
                      value={menuEditor.currency}
                      onChange={e => setMenuEditor({ ...menuEditor, currency: e.target.value.toUpperCase() })}
                      placeholder="TZS"
                      maxLength={8}
                      className={darkMode ? 'bg-[#0a0a1a] border-white/10 text-white placeholder:text-gray-600' : ''}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Station</label>
                  <Select
                    value={menuEditor.station}
                    onValueChange={(v) => setMenuEditor({ ...menuEditor, station: v as 'kitchen' | 'bar' | 'other' })}
                  >
                    <SelectTrigger className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kitchen">Kitchen</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={menuEditor.available}
                    onChange={e => setMenuEditor({ ...menuEditor, available: e.target.checked })}
                    className="rounded"
                  />
                  Visible on guest portal
                </label>
                <div className="flex items-center justify-between pt-2">
                  {menuEditor.id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                      onClick={() => menuEditor.id && deleteMenuItem(menuEditor.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setMenuEditor(null)} className={darkMode ? 'border-white/10' : ''}>Cancel</Button>
                    <Button size="sm" disabled={menuSaving} onClick={saveMenuItem} className="bg-rose-600 hover:bg-rose-700">
                      {menuSaving ? 'Saving…' : (menuEditor.id ? 'Save' : 'Create')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ════════════════════════════════════════════════════════════
            KITCHEN DISPLAY SYSTEM
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'kds' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  KDS — Kitchen Display
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${live.connected ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${live.connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    {live.connected ? 'Live' : 'Offline'}
                  </span>
                </h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Live guest orders routed by station</p>
              </div>
              <div className="flex gap-2">
                {(['all', 'kitchen', 'bar', 'other'] as const).map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={kdsStation === s ? 'default' : 'outline'}
                    onClick={() => setKdsStation(s)}
                    className={kdsStation === s ? 'bg-orange-600 hover:bg-orange-700' : (darkMode ? 'border-white/10' : '')}
                  >
                    {s[0].toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><ChefHat className="w-4 h-4 text-orange-400" /> Orders</h3>
                  {live.loading && <p className="text-xs text-gray-500">Loading…</p>}
                  {!live.loading && live.orders.length === 0 && (
                    <p className="text-xs text-gray-500">No orders yet.</p>
                  )}
                  <div className="space-y-2">
                    {live.orders
                      .filter((o: LiveOrder) => !['DELIVERED', 'CANCELLED'].includes(o.status))
                      .filter((o: LiveOrder) => kdsStation === 'all' || o.items.some(i => (i.station ?? 'kitchen') === kdsStation))
                      .slice(0, 30)
                      .map((o: LiveOrder) => {
                        const items = kdsStation === 'all'
                          ? o.items
                          : o.items.filter(i => (i.station ?? 'kitchen') === kdsStation);
                        const next = NEXT_ORDER_STATUS[o.status] ?? [];
                        return (
                          <div key={o.id} className={`rounded-lg border ${darkMode ? 'border-white/[0.06] bg-[#0a0a1a]' : 'border-gray-200 bg-gray-50'} p-3`}>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-sm font-semibold">
                                  {o.locationType === 'table' ? 'Table' : 'Room'} {o.roomNumber}
                                </p>
                                <p className="text-[10px] text-gray-500 font-mono">{o.id.slice(0, 8)}</p>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
                                {o.status}
                              </span>
                            </div>
                            <div className="space-y-0.5 mb-2">
                              {items.map((it, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span>{it.qty}× {it.name}</span>
                                  <span className="text-gray-500 capitalize">{it.station ?? 'kitchen'}</span>
                                </div>
                              ))}
                            </div>
                            {next.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {next.map(s => (
                                  <Button
                                    key={s}
                                    size="sm"
                                    onClick={() => live.advanceOrder(o.id, s)}
                                    className={s === 'CANCELLED' ? 'h-7 text-xs bg-red-600/80 hover:bg-red-600' : 'h-7 text-xs bg-orange-600 hover:bg-orange-700'}
                                  >
                                    {s}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Brush className="w-4 h-4 text-pink-400" /> Service Requests</h3>
                  {!live.loading && live.requests.filter(r => !['COMPLETED', 'CANCELLED'].includes(r.status)).length === 0 && (
                    <p className="text-xs text-gray-500">No open requests.</p>
                  )}
                  <div className="space-y-2">
                    {live.requests
                      .filter(r => !['COMPLETED', 'CANCELLED'].includes(r.status))
                      .slice(0, 30)
                      .map(r => {
                        const next = NEXT_REQUEST_STATUS[r.status] ?? [];
                        return (
                          <div key={r.id} className={`rounded-lg border ${darkMode ? 'border-white/[0.06] bg-[#0a0a1a]' : 'border-gray-200 bg-gray-50'} p-3 flex items-center justify-between`}>
                            <div>
                              <p className="text-sm font-medium">
                                Room {r.roomNumber} —{' '}
                                {r.kind.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                              </p>
                              <p className="text-[10px] text-gray-500">{r.status}</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {next.map(s => (
                                <Button
                                  key={s}
                                  size="sm"
                                  onClick={() => live.advanceRequest(r.id, s)}
                                  className={s === 'CANCELLED' ? 'h-7 text-xs bg-red-600/80 hover:bg-red-600' : 'h-7 text-xs bg-pink-600 hover:bg-pink-700'}
                                >
                                  {s}
                                </Button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      </main>

      {/* ════════════════════════════════════════════════════════════════
          DIALOGS
      ════════════════════════════════════════════════════════════════ */}

      {/* Room Detail Dialog */}
      <Dialog open={!!selectedRoom} onOpenChange={() => setSelectedRoom(null)}>
        <DialogContent className={`${darkMode ? 'bg-[#13131f] border-white/[0.06] text-white' : ''} max-w-md`}>
          <DialogHeader><DialogTitle>Room {selectedRoom?.number} - {selectedRoom?.type}</DialogTitle></DialogHeader>
          {selectedRoom && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>{statusBadge(selectedRoom.status)}</div>
                <p className="text-lg font-bold text-emerald-400">TZS {selectedRoom.price.toLocaleString()}/night</p>
              </div>
              {selectedRoom.guest && (
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <h4 className="text-sm font-semibold mb-2">Current Guest</h4>
                  <p className="text-sm">{selectedRoom.guest}</p>
                  <p className="text-xs text-gray-400">{GUESTS.find(g => g.name === selectedRoom.guest)?.phone}</p>
                  <p className="text-xs text-gray-400">Check-out: {GUESTS.find(g => g.name === selectedRoom.guest)?.checkOut}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}><p className="text-gray-400">Floor</p><p className="font-medium">{selectedRoom.floor}</p></div>
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}><p className="text-gray-400">Beds</p><p className="font-medium">{selectedRoom.beds}</p></div>
              </div>
              {selectedRoom.status === 'occupied' && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700"><Brush className="w-3 h-3 mr-1" />Request Cleaning</Button>
                  <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''}><AlertTriangle className="w-3 h-3 mr-1" />Report Issue</Button>
                </div>
              )}
              {selectedRoom.status === 'available' && (
                <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => { setActiveTab('reception'); setSelectedRoom(null); }}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />Check In Guest
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={!!receiptGuest} onOpenChange={() => setReceiptGuest(null)}>
        <DialogContent className={`${darkMode ? 'bg-[#13131f] border-white/[0.06] text-white' : ''} max-w-sm`}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" />Receipt</DialogTitle></DialogHeader>
          {receiptGuest && (() => {
            const room = rooms.find(r => r.number === receiptGuest.room);
            const nights = Math.ceil((new Date(receiptGuest.checkOut).getTime() - new Date(receiptGuest.checkIn).getTime()) / (1000 * 60 * 60 * 24));
            const roomCharge = (room?.price || 0) * nights;
            const extras = 15000;
            const vat = Math.round((roomCharge + extras) * 0.18);
            const total = roomCharge + extras + vat;
            return (
              <div className="space-y-3 text-sm">
                <div className="text-center border-b border-white/10 pb-3">
                  <h3 className="font-bold text-lg">Kobe Hotel</h3>
                  <p className="text-xs text-gray-400">Dar es Salaam, Tanzania</p>
                  <p className="text-xs text-gray-400">TIN: 123-456-789</p>
                </div>
                <div className="space-y-1 text-xs">
                  <p><span className="text-gray-400">Guest:</span> {receiptGuest.name}</p>
                  <p><span className="text-gray-400">Room:</span> {receiptGuest.room}</p>
                  <p><span className="text-gray-400">Check-in:</span> {receiptGuest.checkIn}</p>
                  <p><span className="text-gray-400">Check-out:</span> {receiptGuest.checkOut}</p>
                  <p><span className="text-gray-400">Nights:</span> {nights}</p>
                </div>
                <div className="border-t border-white/10 pt-3 space-y-1">
                  <div className="flex justify-between"><span>Room Charge ({nights} nights)</span><span>TZS {roomCharge.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Extras</span><span>TZS {extras.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>VAT (18%)</span><span>TZS {vat.toLocaleString()}</span></div>
                  <div className="flex justify-between text-lg font-bold border-t border-white/10 pt-2"><span>TOTAL</span><span>TZS {total.toLocaleString()}</span></div>
                </div>
                <p className="text-xs text-gray-400 text-center pt-2">Payment: {receiptGuest.paymentMethod}</p>
                <Button size="sm" className="w-full"><Printer className="w-4 h-4 mr-2" />Print Receipt</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Bar Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        {/* ─── Hotel ERP (Drive component) ─── */}
        {activeTab === 'erp' && (() => {
          const hotelData: SharedHotel = {
            id: 'hotel-1',
            name: 'Kobe Hotel',
            subdomain: 'kobe',
            address: 'Dar es Salaam, Tanzania',
            phone: '+255 700 000 000',
            email: 'info@kobehotel.co.tz',
            theme: { primaryColor: '#6366f1', secondaryColor: '#8b5cf6', darkMode: true },
            rooms: rooms.map(r => ({
              id: String(r.id),
              number: r.number,
              type: r.type,
              floor: r.floor ?? 1,
              pricePerNight: r.price ?? 0,
              status: r.status as 'available' | 'occupied' | 'cleaning' | 'maintenance',
              capacity: r.beds ?? 2,
              amenities: [],
              bookings: [],
            })),
            menuCategories: [],
            tables: [],
            staff: [],
            settings: {
              checkInTime: '14:00',
              checkOutTime: '11:00',
              currency: 'TZS',
              taxRate: 18,
              serviceCharge: 10,
              enableQROrdering: true,
              enableRoomService: true,
            },
            createdAt: new Date().toISOString(),
          };
          void hotelData;
          return <HotelAdminDashboard />;
        })()}

        {/* ─── KDS Display (Drive component) ─── */}
        {activeTab === 'kds' && (
          <KDSDisplay
            orders={toKdsOrders(live.orders)}
            station="all"
            onUpdateItemStatus={(orderId, _itemId, status) => {
              // Hotel orders track status at the order level (no per-item),
              // so map a "ready" item toggle to advancing the whole order.
              if (status === 'ready') void live.advanceOrder(orderId, 'READY');
              else void live.advanceOrder(orderId, 'PREPARING');
            }}
            onCompleteOrder={(orderId) => { void live.advanceOrder(orderId, 'READY'); }}
          />
        )}

        {/* ─── QR Customer Portal (Drive component) ─── */}
        {activeTab === 'qr-portal' && (() => {
          const hotelData: SharedHotel = {
            id: 'hotel-1',
            name: 'Kobe Hotel',
            subdomain: 'kobe',
            address: 'Dar es Salaam, Tanzania',
            phone: '+255 700 000 000',
            email: 'info@kobehotel.co.tz',
            theme: { primaryColor: '#6366f1', secondaryColor: '#8b5cf6', darkMode: true },
            rooms: rooms.map(r => ({
              id: String(r.id),
              number: r.number,
              type: r.type,
              floor: r.floor ?? 1,
              pricePerNight: r.price ?? 0,
              status: r.status as 'available' | 'occupied' | 'cleaning' | 'maintenance',
              capacity: r.beds ?? 2,
              amenities: [],
              bookings: [],
            })),
            menuCategories: FOOD_ITEMS.reduce((cats, item) => {
              const cat = cats.find(c => c.name === item.category);
              if (cat) {
                cat.items.push({ id: String(item.id), categoryId: item.category, name: item.name, description: '', price: item.price, isAvailable: true, preparationTime: 10, station: 'kitchen' });
              } else {
                cats.push({ id: item.category, name: item.category, description: '', items: [{ id: String(item.id), categoryId: item.category, name: item.name, description: '', price: item.price, isAvailable: true, preparationTime: 10, station: 'kitchen' }], sortOrder: 0 });
              }
              return cats;
            }, [] as SharedHotel['menuCategories']),
            tables: [],
            staff: [],
            settings: { checkInTime: '14:00', checkOutTime: '11:00', currency: 'TZS', taxRate: 18, serviceCharge: 10, enableQROrdering: true, enableRoomService: true },
            createdAt: new Date().toISOString(),
          };
          return (
            <QRCustomerPortal
              hotel={hotelData}
              tableId="table-1"
              onPlaceOrder={() => {}}
              onCallWaiter={() => {}}
              onRequestService={() => {}}
            />
          );
        })()}

        <DialogContent className={`${darkMode ? 'bg-[#13131f] border-white/[0.06] text-white' : ''} max-w-sm`}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" />Bar Receipt</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg">Kobe Hotel - Bar</h3>
              <p className="text-xs text-gray-400">{barTable} - {new Date().toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              {barCart.map(item => {
                const price = happyHour ? Math.round(item.price * 0.8) : item.price;
                return <div key={item.id} className="flex justify-between text-xs"><span>{item.qty}x {item.name}</span><span>TZS {(price * item.qty).toLocaleString()}</span></div>;
              })}
            </div>
            <div className="border-t border-white/10 pt-3 space-y-1">
              {happyHour && <div className="flex justify-between text-pink-400"><span>Happy Hour Discount</span><span>-{formatTZS(barDiscount)}</span></div>}
              <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>{formatTZS(barSubtotal - barDiscount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">VAT (18%)</span><span>{formatTZS(barVAT)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10"><span>TOTAL</span><span>TZS {barTotal.toLocaleString()}</span></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1"><Printer className="w-4 h-4 mr-2" />Print</Button>
              <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''} onClick={() => { setShowReceipt(false); setBarCart([]); }}><Check className="w-4 h-4 mr-2" />Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
