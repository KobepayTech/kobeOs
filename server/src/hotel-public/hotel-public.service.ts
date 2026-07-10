import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { HotelRoom, HotelGuest, HotelBooking } from '../hotel/hotel.entity';

export interface PublicBookDto {
  roomId?: string;
  roomType?: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
}

/**
 * Public, unauthenticated hotel booking — the room-booking equivalent of the
 * e-commerce storefront. Resolves the hotel by its published slug (same
 * store_settings.domainSlug used by the shop), lists rooms, and takes a
 * booking. Bookings land as PENDING for the front desk to confirm.
 */
@Injectable()
export class HotelPublicService {
  constructor(
    @InjectRepository(StoreSettings) private readonly settings: Repository<StoreSettings>,
    @InjectRepository(HotelRoom) private readonly rooms: Repository<HotelRoom>,
    @InjectRepository(HotelGuest) private readonly guests: Repository<HotelGuest>,
    @InjectRepository(HotelBooking) private readonly bookings: Repository<HotelBooking>,
  ) {}

  private async ownerFor(slug: string): Promise<{ ownerId: string; name: string }> {
    const s =
      (await this.settings.findOne({ where: { domainSlug: slug } })) ??
      (await this.settings.findOne({ where: { customDomain: slug } }));
    if (!s) throw new NotFoundException('Hotel not found');
    return { ownerId: s.ownerId, name: s.storeName || 'Hotel' };
  }

  async listRooms(slug: string) {
    const { ownerId, name } = await this.ownerFor(slug);
    const rooms = await this.rooms.find({ where: { ownerId }, take: 500 });
    return {
      hotelName: name,
      rooms: rooms.map((r) => ({
        id: r.id, roomNumber: r.roomNumber, type: r.type,
        rate: Number(r.rate || 0), currency: r.currency, capacity: r.capacity,
        available: r.status === 'available',
      })),
    };
  }

  async book(slug: string, dto: PublicBookDto) {
    const { ownerId } = await this.ownerFor(slug);
    if (!dto.guestName?.trim() || !dto.guestPhone?.trim()) throw new BadRequestException('Name and phone are required.');
    const inD = new Date(dto.checkIn), outD = new Date(dto.checkOut);
    if (isNaN(inD.getTime()) || isNaN(outD.getTime()) || outD <= inD) throw new BadRequestException('Provide a valid check-in and check-out date.');

    let room = dto.roomId ? await this.rooms.findOne({ where: { ownerId, id: dto.roomId } }) : null;
    if (!room) {
      room = await this.rooms.findOne({ where: { ownerId, status: 'available', ...(dto.roomType ? { type: dto.roomType } : {}) } });
    }
    if (!room) throw new BadRequestException('No available room for those criteria.');

    let guest = await this.guests.findOne({ where: { ownerId, name: dto.guestName.trim() } });
    if (!guest) guest = await this.guests.save(this.guests.create({ ownerId, name: dto.guestName.trim(), phone: dto.guestPhone.trim() }));

    const nights = Math.max(1, Math.round((outD.getTime() - inD.getTime()) / 86_400_000));
    const totalAmount = Number(room.rate || 0) * nights;
    const booking = await this.bookings.save(this.bookings.create({
      ownerId, roomId: room.id, guestId: guest.id, checkIn: inD, checkOut: outD,
      guestCount: dto.guests || 1, status: 'PENDING', totalAmount, currency: room.currency || 'TZS', hotelId: room.hotelId ?? null,
    }));
    await this.rooms.update({ ownerId, id: room.id }, { status: 'reserved' });
    return { ok: true, bookingId: booking.id, room: room.roomNumber, nights, totalAmount, currency: room.currency || 'TZS' };
  }
}
