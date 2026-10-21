/**
 * Backend → reception-screen field mapping.
 *
 * The hotel entities and this screen disagree on names: HotelRoom stores
 * roomNumber/rate/capacity, the screen reads number/price/beds. Without a
 * mapping, rooms fetched from /hotel/rooms arrive with every field the UI
 * reads undefined — room cards render blank, and a lookup by room number can
 * never match a real room, so check-in reports "not synced" for every genuine
 * room.
 *
 * Kept here as pure functions so the mapping is testable on its own. A
 * passing backend test says nothing about whether this screen can read what
 * the backend returned.
 */

export type RoomStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance';

export interface RoomRow {
  /** UUID for a room the server knows; a number only for seed rows. */
  id: number | string;
  number: string;
  type: string;
  status: RoomStatus;
  price: number;
  guest?: string;
  floor: number;
  beds: number;
}

export interface GuestRow {
  id: number;
  bookingId?: string;
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

const ROOM_STATUSES: RoomStatus[] = ['available', 'occupied', 'reserved', 'cleaning', 'maintenance'];

const str = (value: unknown, fallback = ''): string =>
  value === undefined || value === null ? fallback : String(value);

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Rooms carry no floor on the backend, and the room number is where a hotel
 * actually encodes it: 101 is floor 1, 1203 is floor 12. Single and double
 * digit numbers are treated as the ground floor rather than guessed at.
 */
export function floorFromRoomNumber(roomNumber: string): number {
  const digits = str(roomNumber).replace(/\D/g, '');
  if (digits.length <= 2) return 1;
  return num(digits.slice(0, digits.length - 2), 1) || 1;
}

/** Deterministic positive number from a booking id, for React keys. */
export function stableId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash) || 1;
}

export function toRoomRow(row: unknown): RoomRow {
  const r = (row ?? {}) as Record<string, unknown>;
  // Accept either spelling: the server sends roomNumber/rate/capacity, while
  // cached SQLite rows and seed data are already in the screen's shape.
  const number = str(r.roomNumber ?? r.number);
  const status = str(r.status, 'available') as RoomStatus;
  return {
    id: (r.id as number | string) ?? number,
    number,
    type: str(r.type, 'Standard'),
    status: ROOM_STATUSES.includes(status) ? status : 'available',
    price: num(r.rate ?? r.price),
    guest: r.guest ? str(r.guest) : undefined,
    floor: r.floor !== undefined ? num(r.floor, 1) : floorFromRoomNumber(number),
    beds: num(r.capacity ?? r.beds, 1) || 1,
  };
}

/** A row from GET /hotel/front-desk/reservations, which is already joined. */
export function toGuestRow(row: unknown): GuestRow {
  const r = (row ?? {}) as Record<string, unknown>;
  const bookingId = str(r.bookingId);
  const status = str(r.status);
  return {
    id: bookingId ? stableId(bookingId) : num(r.id, Date.now()),
    bookingId: bookingId || undefined,
    name: str(r.guestName ?? r.name),
    room: str(r.roomNumber ?? r.room),
    phone: str(r.guestPhone ?? r.phone),
    email: str(r.guestEmail ?? r.email),
    idNumber: str(r.guestIdNumber ?? r.idNumber),
    nationality: str(r.guestNationality ?? r.nationality),
    checkIn: str(r.checkIn),
    checkOut: str(r.checkOut),
    status: status === 'CHECKED_IN' ? 'Checked-in'
      : status === 'CHECKED_OUT' ? 'Checked-out'
      : status === 'Checked-in' || status === 'Checked-out' ? status
      : 'Reserved',
    guests: num(r.guestCount ?? r.guests, 1) || 1,
    paymentMethod: str(r.paymentMethod),
    balance: num(r.totalAmount ?? r.balance),
  };
}

/** A room the server knows about, and can therefore hold a booking. */
export function serverRoomId(room: { id: number | string } | undefined): string | null {
  return typeof room?.id === 'string' && room.id.length > 10 ? room.id : null;
}
