import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { ModuleSiteSettings } from '../store-settings/module-site-settings.entity';
import { HotelRoom, HotelGuest, HotelBooking } from '../hotel/hotel.entity';
import { PalmPesaService } from '../creators/palmpesa.service';
import { PlatformEventsService } from '../platform/platform.service';

export interface PublicBookDto {
  roomId?: string;
  roomType?: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
}

interface ResolvedHotelSite {
  ownerId: string;
  hotelId: string | null;
  name: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  config: Record<string, unknown>;
}

@Injectable()
export class HotelPublicService {
  constructor(
    @InjectRepository(ModuleSiteSettings)
    private readonly moduleSites: Repository<ModuleSiteSettings>,
    @InjectRepository(StoreSettings)
    private readonly legacySettings: Repository<StoreSettings>,
    @InjectRepository(HotelRoom) private readonly rooms: Repository<HotelRoom>,
    @InjectRepository(HotelGuest) private readonly guests: Repository<HotelGuest>,
    @InjectRepository(HotelBooking) private readonly bookings: Repository<HotelBooking>,
    private readonly palmpesa: PalmPesaService,
    private readonly events: PlatformEventsService,
  ) {}

  private async settingsFor(slug: string): Promise<ResolvedHotelSite> {
    const key = slug.trim().toLowerCase();
    const scoped = await this.moduleSites.findOne({
      where: [
        { moduleId: 'hotel', domainSlug: key, isPublished: true },
        { moduleId: 'hotel', customDomain: key, isPublished: true },
      ],
    });
    if (scoped) {
      return {
        ownerId: scoped.ownerId,
        hotelId: scoped.hotelId,
        name: scoped.name || 'Hotel',
        tagline: scoped.tagline || '',
        logoUrl: scoped.logoUrl || '',
        primaryColor: scoped.primaryColor || '#4f46e5',
        accentColor: scoped.accentColor || '#8b5cf6',
        config: scoped.config ?? {},
      };
    }

    const legacy =
      (await this.legacySettings.findOne({ where: { domainSlug: key } })) ??
      (await this.legacySettings.findOne({ where: { customDomain: key } }));
    if (!legacy) throw new NotFoundException('Hotel not found');
    return {
      ownerId: legacy.ownerId,
      hotelId: null,
      name: legacy.storeName || 'Hotel',
      tagline: legacy.tagline || '',
      logoUrl: legacy.logoUrl || '',
      primaryColor: legacy.primaryColor || '#4f46e5',
      accentColor: legacy.accentColor || '#8b5cf6',
      config: (legacy.siteConfig ?? {}) as Record<string, unknown>,
    };
  }

  private async ownerFor(slug: string): Promise<{ ownerId: string; hotelId: string | null; name: string }> {
    const site = await this.settingsFor(slug);
    return { ownerId: site.ownerId, hotelId: site.hotelId, name: site.name };
  }

  private async hasOverlap(ownerId: string, roomId: string, checkIn: Date, checkOut: Date) {
    const count = await this.bookings.createQueryBuilder('booking')
      .where('booking.ownerId = :ownerId', { ownerId })
      .andWhere('booking.roomId = :roomId', { roomId })
      .andWhere("booking.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')")
      .andWhere('booking.checkIn < :checkOut', { checkOut })
      .andWhere('booking.checkOut > :checkIn', { checkIn })
      .getCount();
    return count > 0;
  }

  private usableToday(room: HotelRoom, checkIn: Date) {
    const today = new Date().toISOString().slice(0, 10);
    const arrival = checkIn.toISOString().slice(0, 10);
    if (room.status === 'maintenance') return false;
    if (arrival <= today && ['occupied', 'cleaning'].includes(room.status)) return false;
    return true;
  }

  async listRooms(slug: string) {
    const siteSettings = await this.settingsFor(slug);
    const ownerId = siteSettings.ownerId;
    const rooms = await this.rooms.find({
      where: { ownerId, ...(siteSettings.hotelId ? { hotelId: siteSettings.hotelId } : {}) },
      take: 500,
    });
    const site = siteSettings.config;
    return {
      hotelName: siteSettings.name,
      branding: {
        logoUrl: siteSettings.logoUrl,
        tagline: siteSettings.tagline,
        primaryColor: siteSettings.primaryColor,
        accentColor: siteSettings.accentColor,
        heroImageUrl: (site.heroImageUrl as string) || '',
        about: (site.about as string) || '',
        amenities: Array.isArray(site.amenities) ? (site.amenities as string[]) : [],
        phone: (site.phone as string) || '',
        whatsapp: (site.whatsapp as string) || '',
        address: (site.address as string) || '',
      },
      rooms: rooms.map((room) => ({
        id: room.id,
        roomNumber: room.roomNumber,
        type: room.type,
        rate: Number(room.rate || 0),
        currency: room.currency,
        capacity: room.capacity,
        available: room.status === 'available',
        imageUrl: room.imageUrl || (site.roomImages as Record<string, string> | undefined)?.[room.id] || (site.roomImageUrl as string) || '',
      })),
    };
  }

  async book(slug: string, dto: PublicBookDto) {
    const { ownerId, hotelId } = await this.ownerFor(slug);
    if (!dto.guestName?.trim() || !dto.guestPhone?.trim()) {
      throw new BadRequestException('Name and phone are required.');
    }
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
      throw new BadRequestException('Provide a valid check-in and check-out date.');
    }

    let room: HotelRoom | null = null;
    if (dto.roomId) {
      const selected = await this.rooms.findOne({ where: { ownerId, id: dto.roomId, ...(hotelId ? { hotelId } : {}) } });
      if (!selected) throw new BadRequestException('Selected room does not exist.');
      if (!this.usableToday(selected, checkIn) || await this.hasOverlap(ownerId, selected.id, checkIn, checkOut)) {
        throw new BadRequestException('Selected room is not available for those dates.');
      }
      room = selected;
    } else {
      const candidates = await this.rooms.find({
        where: {
          ownerId,
          ...(hotelId ? { hotelId } : {}),
          ...(dto.roomType ? { type: dto.roomType } : {}),
        },
        order: { roomNumber: 'ASC' },
        take: 500,
      });
      for (const candidate of candidates) {
        if (!this.usableToday(candidate, checkIn)) continue;
        if (!await this.hasOverlap(ownerId, candidate.id, checkIn, checkOut)) {
          room = candidate;
          break;
        }
      }
    }
    if (!room) throw new BadRequestException('No available room for those dates.');

    let guest = await this.guests.findOne({
      where: { ownerId, phone: dto.guestPhone.trim(), ...(hotelId ? { hotelId } : {}) },
    });
    if (!guest) {
      guest = await this.guests.save(this.guests.create({
        ownerId,
        name: dto.guestName.trim(),
        phone: dto.guestPhone.trim(),
        hotelId,
      }));
    } else if (guest.name !== dto.guestName.trim()) {
      guest.name = dto.guestName.trim();
      guest = await this.guests.save(guest);
    }

    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
    const totalAmount = Number(room.rate || 0) * nights;
    const booking = await this.bookings.save(this.bookings.create({
      ownerId,
      roomId: room.id,
      guestId: guest.id,
      checkIn,
      checkOut,
      guestCount: Math.max(1, dto.guests || 1),
      status: 'PENDING',
      totalAmount,
      currency: room.currency || 'TZS',
      hotelId: room.hotelId ?? null,
    }));
    await this.events.emit({ ownerId, eventName: 'hotel.booking_created', aggregateType: 'HotelBooking', aggregateId: booking.id, payload: { hotelId: booking.hotelId, source: 'hotel_website', totalAmount: booking.totalAmount, currency: booking.currency } });

    const today = new Date().toISOString().slice(0, 10);
    if (checkIn.toISOString().slice(0, 10) <= today && checkOut.toISOString().slice(0, 10) > today && room.status === 'available') {
      await this.rooms.update({ ownerId, id: room.id }, { status: 'reserved' });
    }

    let payment: { initiated: boolean; orderId?: string; message: string } = {
      initiated: false,
      message: 'Booking received — pay at the hotel on arrival.',
    };
    try {
      const response = await this.palmpesa.initiatePayment({
        name: dto.guestName.trim(),
        email: '',
        phone: dto.guestPhone.trim(),
        amountTzs: totalAmount,
        transactionId: `HOTEL-${booking.id}`,
        description: `Room ${room.roomNumber} · ${nights} night(s)`,
      });
      payment = {
        initiated: true,
        orderId: response.order_id,
        message: 'Check your phone and enter your PIN to complete payment.',
      };
      await this.bookings.update({ ownerId, id: booking.id }, { palmPesaOrderId: response.order_id });
    } catch {
      // Payment gateway downtime does not destroy the reservation; front desk can collect it later.
    }

    return {
      ok: true,
      bookingId: booking.id,
      room: room.roomNumber,
      nights,
      totalAmount,
      currency: room.currency || 'TZS',
      payment,
    };
  }
}
