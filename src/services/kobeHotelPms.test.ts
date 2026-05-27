import { describe, expect, it } from 'vitest';
import { buildHotelRoomAudits, evaluateHotelRoom, type KobeHotelRoom } from './kobeHotelPms';
import type { RuViewZone } from './ruviewClient';

function zone(id: string, occupied: boolean, peopleCount = occupied ? 1 : 0): RuViewZone {
  return {
    id,
    name: id,
    type: 'hotel-room',
    building: 'Test Hotel',
    floor: '1',
    occupied,
    peopleCount,
    motionLevel: occupied ? 0.5 : 0,
    confidence: 0.9,
    lastSeenAt: new Date().toISOString(),
    source: 'simulated',
  };
}

describe('KobeHotel PMS room audit', () => {
  it('flags checked-out room with non-guest access and RuView occupancy as critical', () => {
    const audits = buildHotelRoomAudits([
      zone('hotel-room-101', true, 2),
      zone('hotel-room-102', true, 1),
      zone('hotel-room-103', false, 0),
    ]);

    const room101 = audits.find((audit) => audit.room.roomNumber === '101');
    const room102 = audits.find((audit) => audit.room.roomNumber === '102');
    const room103 = audits.find((audit) => audit.room.roomNumber === '103');

    expect(room101?.risk).toBe('critical');
    expect(room101?.reasons.join(' ')).toContain('RuView reports occupancy after checkout');
    expect(room102?.risk).toBe('normal');
    expect(room103?.risk).toBe('normal');
  });

  it('flags vacant PMS room with RuView occupancy as high risk', () => {
    const room: KobeHotelRoom = {
      roomId: 'room-201',
      roomNumber: '201',
      floor: '2',
      roomType: 'Standard',
      ruviewZoneId: 'hotel-room-201',
      roomStatus: 'vacant',
      bookingStatus: 'vacant',
      paymentStatus: 'none',
    };

    const audit = evaluateHotelRoom(room, zone('hotel-room-201', true, 1));

    expect(audit.risk).toBe('high');
    expect(audit.action).toContain('verify the room');
  });

  it('flags active occupied room with incomplete payment as watch risk', () => {
    const room: KobeHotelRoom = {
      roomId: 'room-202',
      roomNumber: '202',
      floor: '2',
      roomType: 'Standard',
      ruviewZoneId: 'hotel-room-202',
      roomStatus: 'occupied',
      bookingStatus: 'active',
      paymentStatus: 'deposit-only',
      bookingId: 'BK-202',
    };

    const audit = evaluateHotelRoom(room, zone('hotel-room-202', true, 1));

    expect(audit.risk).toBe('watch');
    expect(audit.reasons.join(' ')).toContain('deposit-only');
  });
});
