export type RoomStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

export interface PropertyRow { id: string; name: string; slug: string; location?: string; phone?: string; email?: string; currency?: string; }
export interface RoomRow { id: string; roomNumber: string; type: string; rate: number | string; currency: string; capacity: number; status: RoomStatus; imageUrl?: string | null; hotelId?: string | null; }
export interface GuestRow { id: string; name: string; phone: string; email?: string | null; nationality?: string | null; idType?: string | null; idNumber?: string | null; hotelId?: string | null; }
export interface BookingRow { id: string; roomId: string; guestId: string; checkIn: string; checkOut: string; guestCount: number; status: BookingStatus; totalAmount: number | string; currency: string; hotelId?: string | null; createdAt?: string; }
export interface MenuRow { id: string; name: string; category: string; price: number | string; currency: string; available: boolean; station: 'kitchen' | 'bar' | 'other'; imageUrl?: string | null; hotelId?: string | null; }
export interface InventoryRow { id: string; name: string; category: string; quantity: number | string; unit: string; reorderLevel: number | string; costPerUnit?: number | string; currency?: string; hotelId?: string | null; }
export interface StaffRow { id: string; name: string; role: string; phone: string; email?: string | null; status: 'active' | 'off' | 'suspended'; hotelId?: string | null; }
export interface Folio { bookingId: string; total: number; paid: number; outstanding: number; currency: string; payments: Array<{ id: string; amount: number | string; description: string; createdAt: string }>; }

export const money = (value: number | string, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
export const dateLabel = (value: string) => value ? new Date(value).toLocaleDateString() : '—';
export const today = () => new Date().toISOString().slice(0, 10);

export const inputClass = 'mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-cyan-600';
export const primaryButton = 'mt-4 h-10 rounded-xl bg-[#0d2135] px-4 text-xs font-black text-white inline-flex items-center gap-2 disabled:opacity-50';
