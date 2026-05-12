import { useState, useMemo } from 'react';
import {
  Building2, LayoutDashboard, ConciergeBell, Bed, Wine, UtensilsCrossed,
  Package, Users, Calculator, QrCode, Plus, Minus, Search, Trash2,
  CheckCircle2, Clock, X, Check, Printer, Smartphone,
  Banknote, Receipt, Calendar, Phone, User,
  ArrowLeft, Download, TrendingUp, AlertTriangle, Star, Lock,
  Unlock, Eye, Send, Moon, Sun, GlassWater, Beef, CakeSlice,
  Coffee, ChefHat, Brush, ShieldCheck, CircleDollarSign
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
  const [rooms, setRooms] = useState<Room[]>(ROOMS);
  const [guests, setGuests] = useState<Guest[]>(GUESTS);
  const [staff, setStaff] = useState<StaffMember[]>(STAFF);
  const [inventory] = useState<InventoryItem[]>(INVENTORY);
  const [darkMode, setDarkMode] = useState(true);

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
    { id: 'inventory', label: 'Inventory', icon: Package, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    { id: 'staff', label: 'Staff', icon: Users, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    { id: 'accounting', label: 'Accounting', icon: Calculator, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
    { id: 'portal', label: 'Guest Portal', icon: QrCode, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
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
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Friday, June 14, 2024</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className={darkMode ? 'border-white/10' : ''}><Calendar className="w-4 h-4 mr-2" />Today</Button>
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700"><TrendingUp className="w-4 h-4 mr-2" />View Reports</Button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Guests Today', value: '24', icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                { label: 'Rooms Occupied', value: `${occupiedCount}/20`, icon: Bed, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Bar Sales', value: formatTZS(450000), icon: Wine, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'Restaurant Sales', value: formatTZS(680000), icon: UtensilsCrossed, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                { label: 'Pending Checkouts', value: String(pendingCheckouts), icon: Clock, color: 'text-red-400', bg: 'bg-red-500/10' },
                { label: 'Staff on Duty', value: String(staff.filter(s => s.status === 'On Duty').length), icon: ShieldCheck, color: 'text-sky-400', bg: 'bg-sky-500/10' },
              ].map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                  <Card key={i} className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'} hover:scale-[1.02] transition-transform`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${kpi.color}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Daily Revenue</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={REVENUE_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#333' : '#eee'} />
                      <XAxis dataKey="day" tick={{ fill: darkMode ? '#888' : '#666', fontSize: 12 }} />
                      <YAxis tick={{ fill: darkMode ? '#888' : '#666', fontSize: 12 }} tickFormatter={v => `${v / 1000}K`} />
                      <Tooltip contentStyle={{ background: darkMode ? '#1a1a2e' : '#fff', border: darkMode ? '1px solid #333' : '1px solid #eee', borderRadius: 8 }} formatter={(value: number) => formatTZS(value)} />
                      <Bar dataKey="bar" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="restaurant" fill={COLORS.orange} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rooms" fill={COLORS.emerald} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Occupancy Rate (%)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={OCCUPANCY_DATA}>
                      <defs><linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} /><stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#333' : '#eee'} />
                      <XAxis dataKey="day" tick={{ fill: darkMode ? '#888' : '#666', fontSize: 12 }} />
                      <YAxis tick={{ fill: darkMode ? '#888' : '#666', fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: darkMode ? '#1a1a2e' : '#fff', border: darkMode ? '1px solid #333' : '1px solid #eee', borderRadius: 8 }} />
                      <Area type="monotone" dataKey="rate" stroke={COLORS.emerald} fill="url(#occGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Room Status Grid + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className={`lg:col-span-2 ${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Room Status</h3>
                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" />Available</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />Occupied</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" />Cleaning</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500" />Maintenance</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {rooms.map(room => (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        className={`p-2 rounded-lg border text-center transition-all hover:scale-105 ${
                          room.status === 'available' ? 'border-emerald-500/30 bg-emerald-500/10' :
                          room.status === 'occupied' ? 'border-red-500/30 bg-red-500/10' :
                          room.status === 'cleaning' ? 'border-amber-500/30 bg-amber-500/10' :
                          'border-slate-500/30 bg-slate-500/10'
                        }`}
                      >
                        <p className="text-xs font-bold">{room.number}</p>
                        <Bed className="w-3 h-3 mx-auto my-1 opacity-50" />
                        <p className="text-[9px] opacity-70">{room.type}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Recent Activity</h3>
                  <div className="space-y-3 max-h-[280px] overflow-y-auto">
                    {ACTIVITIES.map(a => (
                      <div key={a.id} className="flex items-start gap-3 text-sm">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.type === 'checkin' ? 'bg-emerald-500' : a.type === 'checkout' ? 'bg-blue-500' : a.type === 'alert' ? 'bg-red-500' : a.type === 'order' ? 'bg-amber-500' : 'bg-violet-500'}`} />
                        <div>
                          <p className="text-xs leading-relaxed">{a.text}</p>
                          <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{a.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3">
              {['Check-in', 'Check-out', 'Room Service', 'New Order'].map((action, i) => (
                <Button key={i} variant="outline" className={darkMode ? 'border-white/10 hover:bg-white/5' : ''} onClick={() => {
                  if (action === 'Check-in') setActiveTab('reception');
                  if (action === 'New Order') setActiveTab('bar');
                }}>
                  <Plus className="w-4 h-4 mr-2" />{action}
                </Button>
              ))}
            </div>
          </div>
        )}

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
            ROOMS
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'rooms' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold">Rooms</h1><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Floor Plan View</p></div>
              <div className="flex gap-2">
                {['All', 'Available', 'Occupied', 'Cleaning', 'Maintenance'].map(f => (
                  <Button key={f} size="sm" variant={f === 'All' ? 'default' : 'outline'} className={f === 'All' ? 'bg-emerald-600' : darkMode ? 'border-white/10' : ''}>
                    {f}
                  </Button>
                ))}
                <Button size="sm" className="bg-cyan-600"><Plus className="w-4 h-4 mr-1" />Add Room</Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Available', value: availableCount, color: 'text-emerald-400' },
                { label: 'Occupied', value: occupiedCount, color: 'text-red-400' },
                { label: 'Cleaning', value: cleaningCount, color: 'text-amber-400' },
                { label: 'Maintenance', value: maintenanceCount, color: 'text-slate-400' },
              ].map(s => (
                <Card key={s.label} className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                  <CardContent className="p-4 text-center">
                    <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Floor sections */}
            {[1, 2, 3].map(floor => (
              <div key={floor}>
                <h3 className="text-sm font-semibold mb-3 text-gray-400">Floor {floor}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {rooms.filter(r => r.floor === floor).map(room => (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.03] ${
                        room.status === 'available' ? 'border-emerald-500/30 bg-emerald-500/5' :
                        room.status === 'occupied' ? 'border-red-500/30 bg-red-500/5' :
                        room.status === 'cleaning' ? 'border-amber-500/30 bg-amber-500/5' :
                        'border-slate-500/30 bg-slate-500/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold">{room.number}</span>
                        {room.status === 'occupied' ? <Lock className="w-4 h-4 text-red-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <p className="text-xs text-gray-400">{room.type}</p>
                      <p className="text-xs font-medium mt-1">TZS {room.price.toLocaleString()}/night</p>
                      {room.guest && <p className="text-[10px] text-gray-500 mt-1 truncate">{room.guest}</p>}
                      <div className="mt-2">{statusBadge(room.status)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* QR Code */}
              <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-6 flex flex-col items-center">
                  <h3 className="font-semibold mb-4">Room {portalRoom} QR Code</h3>
                  <div className="bg-white p-4 rounded-xl">
                    <QRCodeSVG value={`https://kobe-hotel.co.tz/room/${portalRoom}`} size={160} />
                  </div>
                  <p className="text-xs text-gray-400 mt-3 text-center">Scan to access digital menu & services</p>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''}><Printer className="w-4 h-4 mr-1" />Print</Button>
                    <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''}><Download className="w-4 h-4 mr-1" />Download</Button>
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
                        <Button size="sm" className="flex-1 bg-pink-600 hover:bg-pink-700"><Send className="w-3 h-3 mr-1" />Place Order</Button>
                        <Button size="sm" variant="outline" className={darkMode ? 'border-white/10' : ''}><Smartphone className="w-3 h-3 mr-1" />M-Pesa</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Services */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Housekeeping', icon: Brush, desc: 'Request cleaning' },
                { label: 'Extra Towels', icon: Bed, desc: 'Fresh towels' },
                { label: 'Wake-up Call', icon: Clock, desc: 'Set alarm' },
                { label: 'Extend Stay', icon: Calendar, desc: 'Add nights' },
                { label: 'Checkout', icon: CheckCircle2, desc: 'Early checkout' },
              ].map(svc => {
                const Icon = svc.icon;
                return (
                  <Card key={svc.label} className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'} hover:border-pink-500/30 transition-all cursor-pointer`}>
                    <CardContent className="p-4 text-center">
                      <Icon className="w-6 h-6 mx-auto mb-2 text-pink-400" />
                      <p className="text-sm font-medium">{svc.label}</p>
                      <p className="text-xs text-gray-400">{svc.desc}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

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
