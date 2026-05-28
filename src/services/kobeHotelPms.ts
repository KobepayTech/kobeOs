import type { RuViewZone } from '@/services/ruviewClient';

export type HotelRoomStatus = 'vacant' | 'occupied' | 'checked-out' | 'cleaning' | 'maintenance';
export type HotelBookingStatus = 'active' | 'checked-out' | 'vacant' | 'cancelled';
export type HotelPaymentStatus = 'paid' | 'unpaid' | 'deposit-only' | 'none';
export type HotelRoomRisk = 'normal' | 'watch' | 'high' | 'critical';

export type HotelAccessLog = {
  openedAt: string;
  openedBy: string;
  accessType: 'guest' | 'staff' | 'manager' | 'mobile' | 'manual';
};

export type KobeHotelRoom = {
  roomId: string;
  roomNumber: string;
  floor: string;
  roomType: string;
  ruviewZoneId: string;
  roomStatus: HotelRoomStatus;
  bookingStatus: HotelBookingStatus;
  paymentStatus: HotelPaymentStatus;
  bookingId?: string;
  guestName?: string;
  lastCheckoutAt?: string;
  lastAccess?: HotelAccessLog;
};

export type HotelRoomAudit = {
  room: KobeHotelRoom;
  zone?: RuViewZone;
  risk: HotelRoomRisk;
  title: string;
  reasons: string[];
  action: string;
};

export const demoKobeHotelRooms: KobeHotelRoom[] = [
  {
    roomId: 'room-101',
    roomNumber: '101',
    floor: '1',
    roomType: 'Deluxe Queen',
    ruviewZoneId: 'hotel-room-101',
    roomStatus: 'checked-out',
    bookingStatus: 'checked-out',
    paymentStatus: 'paid',
    guestName: 'Previous Guest',
    lastCheckoutAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    lastAccess: {
      openedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      openedBy: 'Staff - Mariam',
      accessType: 'staff',
    },
  },
  {
    roomId: 'room-102',
    roomNumber: '102',
    floor: '1',
    roomType: 'Standard Double',
    ruviewZoneId: 'hotel-room-102',
    roomStatus: 'occupied',
    bookingStatus: 'active',
    paymentStatus: 'paid',
    bookingId: 'BK-102-DEMO',
    guestName: 'Active Guest',
    lastAccess: {
      openedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      openedBy: 'Guest Room 102',
      accessType: 'guest',
    },
  },
  {
    roomId: 'room-103',
    roomNumber: '103',
    floor: '1',
    roomType: 'Twin Room',
    ruviewZoneId: 'hotel-room-103',
    roomStatus: 'vacant',
    bookingStatus: 'vacant',
    paymentStatus: 'none',
  },
];

function hasActiveBooking(room: KobeHotelRoom) {
  return room.bookingStatus === 'active' && Boolean(room.bookingId);
}

function isRoomOpenForSale(room: KobeHotelRoom) {
  return room.roomStatus === 'vacant' || room.roomStatus === 'checked-out' || room.bookingStatus === 'vacant' || room.bookingStatus === 'checked-out';
}

function hadNonGuestAccessAfterCheckout(room: KobeHotelRoom) {
  if (!room.lastCheckoutAt || !room.lastAccess) return false;
  const checkout = new Date(room.lastCheckoutAt).getTime();
  const opened = new Date(room.lastAccess.openedAt).getTime();
  const nonGuest = room.lastAccess.accessType !== 'guest';
  return nonGuest && Number.isFinite(checkout) && Number.isFinite(opened) && opened > checkout;
}

export function evaluateHotelRoom(room: KobeHotelRoom, zone?: RuViewZone): HotelRoomAudit {
  const reasons: string[] = [];
  let risk: HotelRoomRisk = 'normal';
  let title = `Room ${room.roomNumber} matches PMS`;
  let action = 'No action needed.';

  const occupiedBySensor = Boolean(zone?.occupied);

  if (!zone) {
    risk = 'watch';
    title = `Room ${room.roomNumber} is not linked to RuView`;
    action = 'Map this PMS room to a RuView zone.';
    reasons.push('No RuView zone was found for this room.');
  }

  if (zone && isRoomOpenForSale(room) && occupiedBySensor) {
    risk = 'high';
    title = `Room ${room.roomNumber} shows occupancy while PMS says ${room.roomStatus}`;
    action = 'Ask manager or security to verify the room before selling it again.';
    reasons.push('RuView reports occupancy.');
    reasons.push('KobeHotel PMS does not show an active booking.');
  }

  if (zone && occupiedBySensor && hadNonGuestAccessAfterCheckout(room) && !hasActiveBooking(room)) {
    risk = 'critical';
    title = `Room ${room.roomNumber} needs manager review`;
    action = 'Hold room sale, verify physically, and review booking/payment/access logs.';
    reasons.push('Room was opened after checkout using non-guest access.');
    reasons.push('RuView reports occupancy after checkout.');
    reasons.push('No active booking is linked to the room.');
  }

  if (zone && occupiedBySensor && hasActiveBooking(room) && room.paymentStatus !== 'paid') {
    risk = risk === 'critical' ? 'critical' : 'watch';
    title = `Room ${room.roomNumber} has occupancy with incomplete payment`;
    action = 'Ask front desk to verify the payment status.';
    reasons.push(`Payment status is ${room.paymentStatus}.`);
  }

  if (reasons.length === 0) {
    reasons.push('RuView and PMS signals are aligned.');
  }

  return { room, zone, risk, title, reasons, action };
}

export function buildHotelRoomAudits(zones: RuViewZone[], rooms: KobeHotelRoom[] = demoKobeHotelRooms): HotelRoomAudit[] {
  return rooms.map((room) => evaluateHotelRoom(room, zones.find((zone) => zone.id === room.ruviewZoneId)));
}
