import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { HotelBooking, HotelGuest, HotelMenuItem, HotelRoom, HotelTenant } from '../hotel/hotel.entity';
import { PlatformEventsService, PlatformNotificationService } from '../platform/platform.service';
import { normalizePhone } from '../commerce/commerce.rules';
import {
  HotelLoyaltyAccount, HotelLoyaltyProgram, LalaGuestFolio, LalaHotelOffer, LalaHotelProfile,
  LalaPassport, LalaReview, LalaRewardsAccount, LalaReverseRequest, LalaRoomInventory,
  LalaRoomType, VerifiedStay, LalaCorporateAccount, LalaGroupBookingRequest,
} from './lala.entity';

const code = (prefix: string) => `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
const dateOnly = (value: string | Date) => new Date(value).toISOString().slice(0, 10);

@Injectable()
export class LalaService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(LalaHotelProfile) private readonly profiles: Repository<LalaHotelProfile>,
    @InjectRepository(LalaRoomType) private readonly roomTypes: Repository<LalaRoomType>,
    @InjectRepository(LalaRoomInventory) private readonly inventory: Repository<LalaRoomInventory>,
    @InjectRepository(LalaPassport) private readonly passports: Repository<LalaPassport>,
    @InjectRepository(LalaReverseRequest) private readonly requests: Repository<LalaReverseRequest>,
    @InjectRepository(LalaHotelOffer) private readonly offers: Repository<LalaHotelOffer>,
    @InjectRepository(HotelTenant) private readonly hotels: Repository<HotelTenant>,
    @InjectRepository(HotelRoom) private readonly rooms: Repository<HotelRoom>,
    @InjectRepository(HotelBooking) private readonly bookings: Repository<HotelBooking>,
    @InjectRepository(HotelGuest) private readonly guests: Repository<HotelGuest>,
    private readonly events: PlatformEventsService,
    private readonly notifications: PlatformNotificationService,
  ) {}

  private repo<T extends object>(entity: new () => T): Repository<T> { return this.ds.getRepository(entity); }

  async saveProfile(ownerId: string, hotelId: string, input: Partial<LalaHotelProfile>) {
    const hotel = await this.hotels.findOne({ where: { ownerId, id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    let row = await this.profiles.findOne({ where: { ownerId, hotelId } });
    row ??= this.profiles.create({ ownerId, hotelId, listed: false, description: '', starRating: 0, amenities: [], images: [], latitude: '', longitude: '', policies: {}, lastMinuteEnabled: true, reverseOffersEnabled: true, guestRating: 0, verifiedReviewCount: 0 });
    const safe = { ...input };
    delete (safe as { id?: string }).id; delete (safe as { ownerId?: string }).ownerId; delete (safe as { hotelId?: string }).hotelId;
    Object.assign(row, safe);
    return this.profiles.save(row);
  }

  async saveRoomType(ownerId: string, hotelId: string, input: Partial<LalaRoomType> & { name: string }) {
    if (!await this.hotels.findOne({ where: { ownerId, id: hotelId } })) throw new NotFoundException('Hotel not found');
    let row = await this.roomTypes.findOne({ where: { ownerId, hotelId, name: input.name } });
    row ??= this.roomTypes.create({ ownerId, hotelId, name: input.name, description: '', capacity: 2, baseRate: 0, currency: 'TZS', amenities: [], images: [], active: true });
    Object.assign(row, input, { ownerId, hotelId });
    return this.roomTypes.save(row);
  }

  listMine(ownerId: string) {
    return this.hotels.find({ where: { ownerId }, order: { createdAt: 'ASC' } }).then(async (hotels) => Promise.all(hotels.map(async (hotel) => ({
      hotel,
      profile: await this.profiles.findOne({ where: { ownerId, hotelId: hotel.id } }),
      roomTypes: await this.roomTypes.find({ where: { ownerId, hotelId: hotel.id } }),
      loyalty: await this.repo(HotelLoyaltyProgram).findOne({ where: { ownerId, hotelId: hotel.id } }),
    }))));
  }

  async setInventory(ownerId: string, hotelId: string, input: { roomTypeId: string; from: string; to: string; availableRooms: number; rate: number; currency?: string }) {
    const roomType = await this.roomTypes.findOne({ where: { ownerId, hotelId, id: input.roomTypeId } });
    if (!roomType) throw new NotFoundException('Room type not found');
    const from = new Date(input.from); const to = new Date(input.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) throw new BadRequestException('Invalid inventory date range');
    const rows: LalaRoomInventory[] = [];
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const stayDate = dateOnly(d);
      let row = await this.inventory.findOne({ where: { hotelId, roomTypeId: roomType.id, stayDate } });
      row ??= this.inventory.create({ hotelId, roomTypeId: roomType.id, stayDate, availableRooms: input.availableRooms, rate: input.rate, currency: input.currency ?? roomType.currency, source: 'KOBEOS', verifiedAt: new Date() });
      row.availableRooms = input.availableRooms; row.rate = input.rate; row.currency = input.currency ?? roomType.currency; row.source = 'KOBEOS'; row.verifiedAt = new Date();
      rows.push(await this.inventory.save(row));
    }
    return rows;
  }

  private async availableRoomIds(hotelId: string, checkIn?: string, checkOut?: string) {
    const rooms = await this.rooms.find({ where: { hotelId, status: In(['available', 'reserved']) } });
    if (!checkIn || !checkOut) return rooms.filter((r) => r.status === 'available');
    const conflicts = await this.bookings.createQueryBuilder('b').select('b.roomId', 'roomId')
      .where('b.hotelId = :hotelId', { hotelId }).andWhere("b.status IN ('PENDING','CONFIRMED','CHECKED_IN')")
      .andWhere('b.checkIn < :checkOut', { checkOut }).andWhere('b.checkOut > :checkIn', { checkIn }).getRawMany<{ roomId: string }>();
    const blocked = new Set(conflicts.map((c) => c.roomId));
    return rooms.filter((r) => !blocked.has(r.id) && r.status !== 'maintenance');
  }

  async search(query: { destination?: string; checkIn?: string; checkOut?: string; guests?: string; maxPrice?: string; amenity?: string; lastMinute?: string }) {
    // Every hotel appears on Lala by default. The Lala profile is optional
    // enrichment (photos, description, rating); the only thing that hides a
    // hotel is an explicit `hiddenFromLala` opt-out. A hotel still needs at
    // least one bookable room for the dates to show up.
    const [hotels, profiles] = await Promise.all([
      this.hotels.find({ order: { createdAt: 'ASC' } }),
      this.profiles.find(),
    ]);
    const pmap = new Map(profiles.map((p) => [p.hotelId, p]));

    // One pass over available menu items → which hotels can take food orders.
    // A menu item is either hotel-specific (hotelId) or owner-global (hotelId
    // NULL, applies to all that owner's hotels).
    const menuItems = await this.repo(HotelMenuItem).find({ where: { available: true } });
    const foodHotelIds = new Set<string>();
    const foodOwnerIds = new Set<string>();
    for (const m of menuItems) {
      if (m.hotelId) foodHotelIds.add(m.hotelId);
      else if (m.ownerId) foodOwnerIds.add(m.ownerId);
    }

    const defaultProfile = { description: '', amenities: [] as string[], images: [] as string[], guestRating: 0, verifiedReviewCount: 0, lastMinuteEnabled: true, reverseOffersEnabled: true };
    const rows: Array<{ hotel: Record<string, unknown>; profile: Record<string, unknown>; availableRooms: Array<Record<string, unknown>>; foodAvailable: boolean; verifiedAvailabilityAt: string }> = [];
    for (const hotel of hotels) {
      const profile = pmap.get(hotel.id);
      if (profile?.hiddenFromLala) continue;
      const amenities = profile?.amenities ?? [];
      if (query.destination && !`${hotel.name} ${hotel.location}`.toLowerCase().includes(query.destination.toLowerCase())) continue;
      if (query.amenity && !amenities.some((a) => a.toLowerCase().includes(query.amenity!.toLowerCase()))) continue;
      if (query.lastMinute === 'true' && !(profile?.lastMinuteEnabled ?? true)) continue;
      const available = await this.availableRoomIds(hotel.id, query.checkIn, query.checkOut);
      const guestCount = Number(query.guests) || 1;
      const eligible = available.filter((r) => r.capacity >= guestCount && (!query.maxPrice || Number(r.rate) <= Number(query.maxPrice)));
      if (!eligible.length) continue;
      rows.push({
        hotel: { id: hotel.id, slug: hotel.slug, name: hotel.name, location: hotel.location, phone: hotel.phone, currency: hotel.currency, logoUrl: hotel.logoUrl },
        profile: profile ? { description: profile.description, amenities: profile.amenities, images: profile.images, guestRating: profile.guestRating, verifiedReviewCount: profile.verifiedReviewCount, lastMinuteEnabled: profile.lastMinuteEnabled, reverseOffersEnabled: profile.reverseOffersEnabled } : defaultProfile,
        availableRooms: eligible.map((r) => ({ id: r.id, roomNumber: r.roomNumber, type: r.type, rate: Number(r.rate), currency: r.currency, capacity: r.capacity, imageUrl: r.imageUrl ?? '' })),
        foodAvailable: foodHotelIds.has(hotel.id) || foodOwnerIds.has(hotel.ownerId),
        verifiedAvailabilityAt: new Date().toISOString(),
      });
    }
    return rows.sort((a, b) => Number(b.profile.guestRating) - Number(a.profile.guestRating));
  }

  async passport(input: { phone: string; name: string; email?: string; nationality?: string; preferences?: Record<string, unknown>; privacy?: Record<string, boolean> }) {
    const phone = normalizePhone(input.phone);
    if (!phone || !input.name?.trim()) throw new BadRequestException('Name and phone are required');
    let row = await this.passports.findOne({ where: { phone } });
    row ??= this.passports.create({ passportNumber: code('LALA'), qrToken: randomBytes(24).toString('base64url'), phone, name: input.name.trim(), email: '', nationality: '', preferences: {}, privacy: { shareName: true, sharePhone: true, shareHistory: false }, active: true });
    row.name = input.name.trim(); row.email = input.email?.trim().toLowerCase() ?? row.email; row.nationality = input.nationality?.trim() ?? row.nationality;
    if (input.preferences) row.preferences = input.preferences; if (input.privacy) row.privacy = { ...row.privacy, ...input.privacy };
    row = await this.passports.save(row);
    let rewards = await this.repo(LalaRewardsAccount).findOne({ where: { passportId: row.id } });
    rewards ??= await this.repo(LalaRewardsAccount).save(this.repo(LalaRewardsAccount).create({ passportId: row.id, points: 0, tier: 'Explorer', verifiedStays: 0 }));
    return { passport: row, rewards, qrUrl: `/lala/passport/${row.qrToken}` };
  }

  async passportByToken(qrToken: string) {
    const row = await this.passports.findOne({ where: { qrToken, active: true } });
    if (!row) throw new NotFoundException('Passport not found');
    const stays = row.privacy.shareHistory ? await this.repo(VerifiedStay).find({ where: { passportId: row.id }, order: { checkOut: 'DESC' }, take: 20 }) : [];
    const hotelAccounts = await this.repo(HotelLoyaltyAccount).find({ where: { passportId: row.id }, order: { updatedAt: 'DESC' } });
    const hotelIds = [...new Set(hotelAccounts.map((account) => account.hotelId))]; const hotels = hotelIds.length ? await this.hotels.find({ where: { id: In(hotelIds) } }) : [];
    return { passport: { passportNumber: row.passportNumber, name: row.privacy.shareName ? row.name : 'Lala guest', phone: row.privacy.sharePhone ? row.phone : '', nationality: row.nationality, preferences: row.preferences }, stays, rewards: await this.repo(LalaRewardsAccount).findOne({ where: { passportId: row.id } }), hotelLoyalty: hotelAccounts.map((account) => ({ ...account, hotelName: hotels.find((hotel) => hotel.id === account.hotelId)?.name ?? 'Hotel loyalty' })) };
  }

  async book(input: { hotelId: string; roomId: string; passportToken: string; checkIn: string; checkOut: string; guests?: number }) {
    const passport = await this.passports.findOne({ where: { qrToken: input.passportToken, active: true } });
    if (!passport) throw new BadRequestException('Valid Lala Passport is required');
    const available = await this.availableRoomIds(input.hotelId, input.checkIn, input.checkOut);
    const room = available.find((r) => r.id === input.roomId);
    if (!room) throw new BadRequestException('Room is not available for those dates');
    const hotel = await this.hotels.findOne({ where: { id: input.hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    const inDate = new Date(input.checkIn); const outDate = new Date(input.checkOut);
    if (outDate <= inDate) throw new BadRequestException('Check-out must be after check-in');
    const nights = Math.max(1, Math.ceil((outDate.getTime() - inDate.getTime()) / 86_400_000));
    const booking = await this.ds.transaction(async (tx) => {
      let guest = await tx.getRepository(HotelGuest).findOne({ where: { ownerId: hotel.ownerId, hotelId: hotel.id, phone: passport.phone } });
      guest ??= await tx.getRepository(HotelGuest).save(tx.getRepository(HotelGuest).create({ ownerId: hotel.ownerId, hotelId: hotel.id, name: passport.name, phone: passport.phone, email: passport.email || null, nationality: passport.nationality || null }));
      const row = await tx.getRepository(HotelBooking).save(tx.getRepository(HotelBooking).create({ ownerId: hotel.ownerId, hotelId: hotel.id, roomId: room.id, guestId: guest.id, checkIn: inDate, checkOut: outDate, guestCount: input.guests ?? 1, status: 'PENDING', totalAmount: Number(room.rate) * nights, currency: room.currency }));
      await tx.getRepository(LalaGuestFolio).save(tx.getRepository(LalaGuestFolio).create({ bookingId: row.id, hotelId: hotel.id, passportId: passport.id, roomCharges: row.totalAmount, foodCharges: 0, otherCharges: 0, payments: 0, status: 'OPEN' }));
      return row;
    });
    await this.events.emit({ ownerId: hotel.ownerId, eventName: 'hotel.booking_created', aggregateType: 'HotelBooking', aggregateId: booking.id, payload: { hotelId: hotel.id, source: 'lala', passportId: passport.id } });
    await this.notifications.send({ ownerId: hotel.ownerId, recipientKey: passport.id, phone: passport.phone, title: 'Lala booking received', body: `${hotel.name}: booking ${booking.id.slice(0, 8)} received for ${input.checkIn} to ${input.checkOut}.`, actionUrl: `/lala/booking/${booking.id}`, channels: ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP'] });
    return { booking, hotel: hotel.name, room: room.roomNumber, nights };
  }

  async saveLoyaltyProgram(ownerId: string, hotelId: string, input: Partial<HotelLoyaltyProgram>) {
    if (!await this.hotels.findOne({ where: { id: hotelId, ownerId } })) throw new NotFoundException('Hotel not found');
    const repo = this.repo(HotelLoyaltyProgram);
    let row = await repo.findOne({ where: { ownerId, hotelId } });
    row ??= repo.create({ ownerId, hotelId, name: 'Hotel Loyalty', active: true, programType: 'POINTS', pointsPerCurrencyUnit: 1, welcomePoints: 0, expiryDays: 365, eligibility: {}, tiers: [], rewards: [] });
    Object.assign(row, input, { ownerId, hotelId }); return repo.save(row);
  }

  async completeStay(ownerId: string, bookingId: string) {
    const booking = await this.bookings.findOne({ where: { id: bookingId, ownerId } });
    if (!booking || !booking.hotelId) throw new NotFoundException('Booking not found');
    const existing = await this.repo(VerifiedStay).findOne({ where: { bookingId } });
    if (existing) return existing;
    const [guest, program, folio] = await Promise.all([
      this.guests.findOne({ where: { id: booking.guestId, ownerId } }),
      this.repo(HotelLoyaltyProgram).findOne({ where: { ownerId, hotelId: booking.hotelId, active: true } }),
      this.repo(LalaGuestFolio).findOne({ where: { bookingId } }),
    ]);
    if (!guest) throw new NotFoundException('Guest not found');
    const passport = (await this.passport({ phone: guest.phone, name: guest.name, email: guest.email ?? '', nationality: guest.nationality ?? '' })).passport;
    const spend = Number(booking.totalAmount) + Number(folio?.foodCharges ?? 0) + Number(folio?.otherCharges ?? 0);
    const hotelPoints = program ? Math.floor((spend / 1000) * Number(program.pointsPerCurrencyUnit)) : 0;
    const lalaPoints = Math.floor(spend / 10_000);
    const stay = await this.ds.transaction(async (tx) => {
      const row = await tx.getRepository(VerifiedStay).save(tx.getRepository(VerifiedStay).create({ bookingId, hotelId: booking.hotelId!, passportId: passport.id, checkIn: dateOnly(booking.checkIn), checkOut: dateOnly(booking.checkOut), eligibleSpend: spend, hotelPointsEarned: hotelPoints, lalaPointsEarned: lalaPoints, reviewEligible: true }));
      if (program) {
        let account = await tx.getRepository(HotelLoyaltyAccount).findOne({ where: { hotelId: booking.hotelId!, passportId: passport.id } });
        account ??= tx.getRepository(HotelLoyaltyAccount).create({ hotelId: booking.hotelId!, passportId: passport.id, points: program.welcomePoints, tier: 'Member', stays: 0, lifetimeSpend: 0 });
        account.points += hotelPoints; account.stays += 1; account.lifetimeSpend = Number(account.lifetimeSpend) + spend;
        const tier = [...program.tiers].sort((a, b) => b.minimumPoints - a.minimumPoints).find((t) => account!.points >= t.minimumPoints);
        if (tier) account.tier = tier.name;
        await tx.getRepository(HotelLoyaltyAccount).save(account);
      }
      let rewards = await tx.getRepository(LalaRewardsAccount).findOne({ where: { passportId: passport.id } });
      rewards ??= tx.getRepository(LalaRewardsAccount).create({ passportId: passport.id, points: 0, tier: 'Explorer', verifiedStays: 0 });
      rewards.points += lalaPoints; rewards.verifiedStays += 1; rewards.tier = rewards.verifiedStays >= 20 ? 'Ambassador' : rewards.verifiedStays >= 5 ? 'Traveller' : 'Explorer';
      await tx.getRepository(LalaRewardsAccount).save(rewards);
      booking.status = 'CHECKED_OUT'; await tx.getRepository(HotelBooking).save(booking);
      if (folio) { folio.status = 'CLOSED'; await tx.getRepository(LalaGuestFolio).save(folio); }
      return row;
    });
    await this.events.emit({ ownerId, eventName: 'lala.stay_completed', aggregateType: 'VerifiedStay', aggregateId: stay.id, payload: { bookingId, hotelId: booking.hotelId, passportId: passport.id } });
    if (hotelPoints) await this.events.emit({ ownerId, eventName: 'hotel.loyalty_earned', aggregateType: 'HotelLoyaltyAccount', payload: { hotelId: booking.hotelId, passportId: passport.id, points: hotelPoints } });
    if (lalaPoints) await this.events.emit({ eventName: 'lala.reward_earned', aggregateType: 'LalaRewardsAccount', payload: { passportId: passport.id, points: lalaPoints } });
    return stay;
  }

  async review(input: { passportToken: string; verifiedStayId: string; rating: number; comment?: string }) {
    const passport = await this.passports.findOne({ where: { qrToken: input.passportToken, active: true } });
    if (!passport) throw new BadRequestException('Valid passport required');
    const stay = await this.repo(VerifiedStay).findOne({ where: { id: input.verifiedStayId, passportId: passport.id, reviewEligible: true } });
    if (!stay) throw new BadRequestException('Only a verified completed stay can be reviewed');
    if (await this.repo(LalaReview).findOne({ where: { verifiedStayId: stay.id } })) throw new ConflictException('This stay was already reviewed');
    const review = await this.repo(LalaReview).save(this.repo(LalaReview).create({ verifiedStayId: stay.id, hotelId: stay.hotelId, passportId: passport.id, rating: Math.max(1, Math.min(5, Math.floor(input.rating))), comment: input.comment?.trim() ?? '', verified: true }));
    const stats = await this.repo(LalaReview).createQueryBuilder('r').select('AVG(r.rating)', 'average').addSelect('COUNT(*)', 'count').where('r.hotelId = :hotelId', { hotelId: stay.hotelId }).getRawOne<{ average: string; count: string }>();
    const profile = await this.profiles.findOne({ where: { hotelId: stay.hotelId } });
    if (profile) { profile.guestRating = Number(stats?.average) || 0; profile.verifiedReviewCount = Number(stats?.count) || 0; await this.profiles.save(profile); }
    stay.reviewEligible = false; await this.repo(VerifiedStay).save(stay); return review;
  }

  async createReverseRequest(input: { passportToken: string; destination: string; checkIn: string; checkOut: string; guests?: number; budget?: number; currency?: string }) {
    const passport = await this.passports.findOne({ where: { qrToken: input.passportToken, active: true } });
    if (!passport) throw new BadRequestException('Valid passport required');
    if (new Date(input.checkOut) <= new Date(input.checkIn)) throw new BadRequestException('Check-out must be after check-in');
    return this.requests.save(this.requests.create({ passportId: passport.id, destination: input.destination, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests ?? 1, budget: input.budget ?? 0, currency: input.currency ?? 'TZS', status: 'OPEN' }));
  }

  async openRequests(ownerId: string) {
    const hotelIds = (await this.hotels.find({ where: { ownerId } })).map((h) => h.id);
    const profiles = await this.profiles.find({ where: { ownerId, reverseOffersEnabled: true } });
    if (!profiles.some((p) => hotelIds.includes(p.hotelId))) return [];
    return this.requests.find({ where: { status: 'OPEN' }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async offer(ownerId: string, requestId: string, input: { hotelId: string; roomId: string; totalPrice: number; currency?: string; message?: string; expiresAt: string }) {
    const [request, hotel, room] = await Promise.all([this.requests.findOne({ where: { id: requestId, status: 'OPEN' } }), this.hotels.findOne({ where: { id: input.hotelId, ownerId } }), this.rooms.findOne({ where: { id: input.roomId, ownerId, hotelId: input.hotelId } })]);
    if (!request || !hotel || !room) throw new NotFoundException('Request, hotel or room not found');
    if (!(await this.availableRoomIds(hotel.id, request.checkIn, request.checkOut)).some((r) => r.id === room.id)) throw new BadRequestException('Room is unavailable');
    let row = await this.offers.findOne({ where: { requestId, hotelId: hotel.id } });
    row ??= this.offers.create({ ownerId, requestId, hotelId: hotel.id, roomId: room.id, totalPrice: input.totalPrice, currency: input.currency ?? hotel.currency, message: input.message ?? '', expiresAt: new Date(input.expiresAt), status: 'ACTIVE' });
    Object.assign(row, { roomId: room.id, totalPrice: input.totalPrice, currency: input.currency ?? hotel.currency, message: input.message ?? '', expiresAt: new Date(input.expiresAt), status: 'ACTIVE' });
    return this.offers.save(row);
  }

  async requestOffers(passportToken: string, requestId: string) {
    const passport = await this.passports.findOne({ where: { qrToken: passportToken } });
    const request = passport && await this.requests.findOne({ where: { id: requestId, passportId: passport.id } });
    if (!request) throw new NotFoundException('Request not found');
    const offers = await this.offers.find({ where: { requestId, status: 'ACTIVE' }, order: { totalPrice: 'ASC' } });
    return Promise.all(offers.filter((o) => o.expiresAt > new Date()).map(async (o) => ({ ...o, hotel: await this.hotels.findOne({ where: { id: o.hotelId } }), room: await this.rooms.findOne({ where: { id: o.roomId } }) })));
  }

  async createCorporateAccount(input: { name: string; contactName?: string; phone?: string; email?: string; type?: 'CORPORATE' | 'AGENT' }) {
    if (!input.name?.trim() || (!input.phone?.trim() && !input.email?.trim())) throw new BadRequestException('Organisation name and a phone or email are required');
    return this.repo(LalaCorporateAccount).save(this.repo(LalaCorporateAccount).create({ name: input.name.trim(), contactName: input.contactName?.trim() ?? '', phone: normalizePhone(input.phone ?? ''), email: input.email?.trim().toLowerCase() ?? '', type: input.type ?? 'CORPORATE', status: 'ACTIVE' }));
  }

  async createGroupRequest(input: { corporateAccountId?: string; destination: string; checkIn: string; checkOut: string; rooms: number; guests: number }) {
    if (new Date(input.checkOut) <= new Date(input.checkIn) || input.rooms < 1 || input.guests < 1) throw new BadRequestException('Valid dates, rooms and guests are required');
    if (input.corporateAccountId && !await this.repo(LalaCorporateAccount).findOne({ where: { id: input.corporateAccountId, status: 'ACTIVE' } })) throw new BadRequestException('Corporate or agent account not found');
    return this.repo(LalaGroupBookingRequest).save(this.repo(LalaGroupBookingRequest).create({ corporateAccountId: input.corporateAccountId ?? null, destination: input.destination.trim(), checkIn: input.checkIn, checkOut: input.checkOut, rooms: Math.floor(input.rooms), guests: Math.floor(input.guests), status: 'OPEN' }));
  }

  async groupRequests(ownerId: string) {
    const listed = await this.profiles.count({ where: { ownerId, listed: true } });
    return listed ? this.repo(LalaGroupBookingRequest).find({ where: { status: 'OPEN' }, order: { createdAt: 'DESC' }, take: 200 }) : [];
  }
}
