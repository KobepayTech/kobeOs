import { describe, expect, it } from 'vitest';
import {
  floorFromRoomNumber,
  serverRoomId,
  stableId,
  toGuestRow,
  toRoomRow,
} from './room-mapping';

/**
 * These exist because a green backend suite said nothing about whether the
 * reception screen could read what the backend returned. It could not: rooms
 * arrived as roomNumber/rate while the screen reads number/price, so every
 * room card was blank and check-in reported "room not synced" for every real
 * room.
 */
describe('hotel room mapping', () => {
  const serverRoom = {
    id: '7a40c033-32c2-4a86-bdb2-b4e22966a719',
    roomNumber: '204',
    type: 'Double',
    rate: 85000,
    capacity: 2,
    status: 'occupied',
  };

  it('maps the server field names the screen does not use', () => {
    const room = toRoomRow(serverRoom);
    expect(room.number).toBe('204');
    expect(room.price).toBe(85000);
    expect(room.beds).toBe(2);
    expect(room.id).toBe(serverRoom.id);
  });

  it('leaves no field the screen reads undefined', () => {
    const room = toRoomRow(serverRoom) as unknown as Record<string, unknown>;
    for (const key of ['id', 'number', 'type', 'status', 'price', 'floor', 'beds']) {
      expect(room[key], `${key} must be populated`).not.toBeUndefined();
    }
  });

  it('lets a room be found by its number, which check-in depends on', () => {
    const rooms = [serverRoom, { ...serverRoom, id: 'other-uuid-1234567890', roomNumber: '205' }]
      .map(toRoomRow);
    const match = rooms.find((r) => r.number === '204');
    expect(match).toBeTruthy();
    expect(serverRoomId(match)).toBe(serverRoom.id);
  });

  it('accepts rows already in the screen shape, from cache or seed', () => {
    const cached = { id: 3, number: '101', type: 'Single', price: 40000, beds: 1, floor: 1, status: 'available' };
    expect(toRoomRow(cached)).toMatchObject({ number: '101', price: 40000, beds: 1, id: 3 });
  });

  it('keeps reserved as reserved instead of mislabelling it', () => {
    expect(toRoomRow({ ...serverRoom, status: 'reserved' }).status).toBe('reserved');
  });

  it('falls back to available for a status it does not know', () => {
    expect(toRoomRow({ ...serverRoom, status: 'nonsense' }).status).toBe('available');
  });

  it('survives a malformed row rather than throwing in render', () => {
    for (const row of [null, undefined, {}, 'text', 42]) {
      expect(() => toRoomRow(row)).not.toThrow();
    }
    expect(toRoomRow({}).beds).toBe(1);
    expect(toRoomRow({}).price).toBe(0);
  });

  describe('floor from room number', () => {
    it('reads the floor a hotel encodes in the number', () => {
      expect(floorFromRoomNumber('101')).toBe(1);
      expect(floorFromRoomNumber('204')).toBe(2);
      expect(floorFromRoomNumber('1203')).toBe(12);
    });

    it('treats short numbers as the ground floor rather than guessing', () => {
      expect(floorFromRoomNumber('7')).toBe(1);
      expect(floorFromRoomNumber('12')).toBe(1);
      expect(floorFromRoomNumber('')).toBe(1);
    });

    it('ignores letters in a suite name', () => {
      expect(floorFromRoomNumber('A302')).toBe(3);
    });
  });

  describe('server room id', () => {
    it('recognises a room the server can hold a booking against', () => {
      expect(serverRoomId({ id: '7a40c033-32c2-4a86-bdb2-b4e22966a719' })).toBeTruthy();
    });

    it('rejects a seed room, which cannot hold a booking', () => {
      expect(serverRoomId({ id: 3 })).toBeNull();
      expect(serverRoomId(undefined)).toBeNull();
      // A room number used as a stand-in id is not a server id either.
      expect(serverRoomId({ id: '204' })).toBeNull();
    });
  });

  describe('reservation rows', () => {
    const reservation = {
      bookingId: 'b1b2b3b4-0000-0000-0000-000000000001',
      status: 'CHECKED_IN',
      roomNumber: '204',
      guestName: 'Juma Mwinyi',
      guestPhone: '0712345678',
      guestEmail: 'juma@example.com',
      guestIdNumber: 'ID-900',
      guestNationality: 'Tanzanian',
      checkIn: '2026-11-01',
      checkOut: '2026-11-04',
      guestCount: 2,
      totalAmount: 255000,
    };

    it('maps a joined reservation into the row the table renders', () => {
      expect(toGuestRow(reservation)).toMatchObject({
        bookingId: reservation.bookingId,
        name: 'Juma Mwinyi',
        room: '204',
        phone: '0712345678',
        idNumber: 'ID-900',
        status: 'Checked-in',
        guests: 2,
        balance: 255000,
      });
    });

    it('translates every backend status the screen can receive', () => {
      expect(toGuestRow({ ...reservation, status: 'CHECKED_OUT' }).status).toBe('Checked-out');
      expect(toGuestRow({ ...reservation, status: 'CONFIRMED' }).status).toBe('Reserved');
      expect(toGuestRow({ ...reservation, status: 'PENDING' }).status).toBe('Reserved');
    });

    it('gives the same booking the same id across reloads', () => {
      expect(toGuestRow(reservation).id).toBe(toGuestRow(reservation).id);
      expect(toGuestRow(reservation).id).toBe(stableId(reservation.bookingId));
    });

    it('marks a row with no booking id as unsaveable rather than inventing one', () => {
      expect(toGuestRow({ ...reservation, bookingId: '' }).bookingId).toBeUndefined();
    });
  });
});
