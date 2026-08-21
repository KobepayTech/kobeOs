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

/**
 * Public, unauthenticated hotel booking. Hotel website branding is resolved
 * from module_site_settings(moduleId='hotel'), so editing the booking site can
 * never overwrite the ERP, cargo, or property website. A legacy fallback keeps
 * old deployments working until the migration has run.
 */
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

    // Backward compatibility for databases that have not run the migration.
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
      rooms: rooms.map((r) => ({
        id: r.id,
        roomNumber: r.roomNumber,
        type: r.type,
        rate: Number(r.rate || 0),
        currency: r.currency,
        capacity: r.capacity,
        available: r.status === 'available',
        imageUrl: r.imageUrl || (site.roomImages as Record<string, string> | undefined)?.[r.id] || (site.roomImageUrl as string) || '',
      })),
    };
  }

  async book(slug: string, dto: PublicBookDto) {
    const { ownerId, hotelId } = await this.ownerFor(slug);
    if (!dto.guestName?.trim() || !dto.guestPhone?.trim()) {
      throw new BadRequestException('Name and phone are required.');
    }
    const inD = new Date(dto.checkIn);
    const outD = new Date(dto.checkOut);
    if (isNaN(inD.getTime()) || isNaN(outD.getTime()) || outD <= inD) {
      throw new BadRequestException('Provide a valid check-in and check-out date.');
    }

    let room = dto.roomId
      ? await this.rooms.findOne({ where: { ownerId, id: dto.roomId, ...(hotelId ? { hotelId } : {}) } })
      : null;
    if (!room) {
      room = await this.rooms.findOne({
        where: {
          ownerId,
          ...(hotelId ? { hotelId } : {}),
          status: 'available',
          ...(dto.roomType ? { type: dto.roomType } : {}),
        },
      });
    }
    if (!room) throw new BadRequestException('No available room for those criteria.');

    let guest = await this.guests.findOne({
      where: { ownerId, name: dto.guestName.trim(), ...(hotelId ? { hotelId } : {}) },
    });
    if (!guest) {
      guest = await this.guests.save(this.guests.create({
        ownerId,
        name: dto.guestName.trim(),
        phone: dto.guestPhone.trim(),
        hotelId,
      }));
    }

    const nights = Math.max(1, Math.round((outD.getTime() - inD.getTime()) / 86_400_000));
    const totalAmount = Number(room.rate || 0) * nights;
    const booking = await this.bookings.save(this.bookings.create({
      ownerId,
      roomId: room.id,
      guestId: guest.id,
      checkIn: inD,
      checkOut: outD,
      guestCount: dto.guests || 1,
      status: 'PENDING',
      totalAmount,
      currency: room.currency || 'TZS',
      hotelId: room.hotelId ?? null,
    }));
    await this.events.emit({ ownerId, eventName: 'hotel.booking_created', aggregateType: 'HotelBooking', aggregateId: booking.id, payload: { hotelId: booking.hotelId, source: 'hotel_website', totalAmount: booking.totalAmount, currency: booking.currency } });
    await this.rooms.update({ ownerId, id: room.id, ...(hotelId ? { hotelId } : {}) }, { status: 'reserved' });

    let payment: { initiated: boolean; orderId?: string; message: string } = {
      initiated: false,
      message: 'Booking received — pay at the hotel on arrival.',
    };
    try {
      const res = await this.palmpesa.initiatePayment({
        name: dto.guestName.trim(),
        email: '',
        phone: dto.guestPhone.trim(),
        amountTzs: totalAmount,
        transactionId: `HOTEL-${booking.id}`,
        description: `Room ${room.roomNumber} · ${nights} night(s)`,
      });
      payment = {
        initiated: true,
        orderId: res.order_id,
        message: 'Check your phone and enter your PIN to complete payment.',
      };
      await this.bookings.update(
        { ownerId, id: booking.id },
        { palmPesaOrderId: res.order_id },
      );
    } catch {
      // Gateway unavailable — booking remains valid and can be paid on arrival.
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
