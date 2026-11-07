import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HotelBooking, HotelFinancialRecord, HotelGuest, HotelRoom } from './hotel.entity';
import { CloudRoomAllotment } from '../cloud-continuity/continuity.entity';
import { blocksLocalSale, windowsOverlap } from '../cloud-continuity/continuity.rules';

export interface CreateFrontDeskReservationInput {
  roomId: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  guestNationality?: string;
  guestIdType?: string;
  guestIdNumber?: string;
  checkIn: string;
  checkOut: string;
  guestCount?: number;
  totalAmount?: number;
}

export interface RecordHotelPaymentInput {
  amount: number;
  method: 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK';
  reference?: string;
  note?: string;
}

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

@Injectable()
export class HotelFrontDeskService {
  constructor(
    @InjectRepository(HotelRoom) private readonly rooms: Repository<HotelRoom>,
    @InjectRepository(HotelGuest) private readonly guests: Repository<HotelGuest>,
    @InjectRepository(HotelBooking) private readonly bookings: Repository<HotelBooking>,
    @InjectRepository(HotelFinancialRecord) private readonly financials: Repository<HotelFinancialRecord>,
  ) {}

  private async withRoom<T>(ownerId: string, roomId: string, action: (service: HotelFrontDeskService) => Promise<T>): Promise<T> {
    return this.rooms.manager.transaction(async (tx) => {
      const room = await tx.getRepository(HotelRoom).findOne({ where: { id: roomId, ownerId }, lock: { mode: 'pessimistic_write' } });
      if (!room) throw new NotFoundException('Room not found.');
      const service = new HotelFrontDeskService(tx.getRepository(HotelRoom), tx.getRepository(HotelGuest), tx.getRepository(HotelBooking), tx.getRepository(HotelFinancialRecord));
      return action(service);
    });
  }

  /**
   * Refuse nights that belong to the online continuity layer.
   *
   * Queried through this.bookings.manager rather than an injected service
   * because withRoom hand-constructs this class with exactly four
   * repositories; a fifth constructor argument would break that silently. Via
   * the manager the query also runs inside withRoom's room-row lock, which is
   * what serialises it against an allotment being granted at the same moment —
   * grantRoom locks the same row.
   *
   * Anything short of an acknowledged release blocks, an expired window
   * included: the cloud may be holding a reservation for it and may not be
   * reachable to ask.
   */
  private async ensureNotAllottedOnline(ownerId: string, roomId: string, checkIn: Date, checkOut: Date): Promise<void> {
    const held = await this.bookings.manager.getRepository(CloudRoomAllotment).find({ where: { ownerId, roomId } });
    for (const allotment of held) {
      if (!blocksLocalSale(allotment.status, allotment.acknowledgedAt)) continue;
      const from = new Date(`${String(allotment.fromDate).slice(0, 10)}T00:00:00Z`);
      const to = new Date(`${String(allotment.toDate).slice(0, 10)}T00:00:00Z`);
      if (windowsOverlap(checkIn, checkOut, from, to)) {
        throw new ConflictException(
          'Those nights are allotted to online booking. Reclaim the allotment and wait for it to be released before selling them here.',
        );
      }
    }
  }

  private parseStay(checkInValue: string, checkOutValue: string) {
    const checkIn = new Date(checkInValue);
    const checkOut = new Date(checkOutValue);
    if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) {
      throw new BadRequestException('Check-out must be after check-in.');
    }
    return { checkIn, checkOut };
  }

  private async roomForOwner(ownerId: string, roomId: string) {
    const room = await this.rooms.findOne({ where: { ownerId, id: roomId } });
    if (!room) throw new NotFoundException('Room not found.');
    return room;
  }

  private async bookingForOwner(ownerId: string, bookingId: string) {
    const booking = await this.bookings.findOne({ where: { ownerId, id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found.');
    return booking;
  }

  private async ensureNoOverlap(ownerId: string, roomId: string, checkIn: Date, checkOut: Date, excludeId?: string) {
    const qb = this.bookings.createQueryBuilder('booking')
      .where('booking.ownerId = :ownerId', { ownerId })
      .andWhere('booking.roomId = :roomId', { roomId })
      .andWhere("booking.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')")
      .andWhere('booking.checkIn < :checkOut', { checkOut })
      .andWhere('booking.checkOut > :checkIn', { checkIn });
    if (excludeId) qb.andWhere('booking.id != :excludeId', { excludeId });
    const conflict = await qb.getOne();
    if (conflict) {
      throw new BadRequestException(
        `Room already has an active reservation from ${dateOnly(new Date(conflict.checkIn))} to ${dateOnly(new Date(conflict.checkOut))}.`,
      );
    }
  }

  async createReservation(ownerId: string, input: CreateFrontDeskReservationInput) {
    return this.withRoom(ownerId, input.roomId, (service) => service.createReservationLocked(ownerId, input));
  }

  private async createReservationLocked(ownerId: string, input: CreateFrontDeskReservationInput) {
    const room = await this.roomForOwner(ownerId, input.roomId);
    if (room.status === 'maintenance') throw new BadRequestException('Room is under maintenance.');
    const { checkIn, checkOut } = this.parseStay(input.checkIn, input.checkOut);
    await this.ensureNoOverlap(ownerId, room.id, checkIn, checkOut);
    await this.ensureNotAllottedOnline(ownerId, room.id, checkIn, checkOut);

    const hotelId = room.hotelId ?? null;
    let guest = await this.guests.findOne({
      where: hotelId
        ? { ownerId, phone: input.guestPhone.trim(), hotelId }
        : { ownerId, phone: input.guestPhone.trim() },
    });
    if (!guest) {
      guest = this.guests.create({
        ownerId,
        hotelId,
        name: input.guestName.trim(),
        phone: input.guestPhone.trim(),
        email: input.guestEmail?.trim() || null,
        nationality: input.guestNationality?.trim() || null,
        idType: input.guestIdType?.trim() || null,
        idNumber: input.guestIdNumber?.trim() || null,
      });
    } else {
      guest.name = input.guestName.trim() || guest.name;
      if (input.guestEmail !== undefined) guest.email = input.guestEmail.trim() || null;
      if (input.guestNationality !== undefined) guest.nationality = input.guestNationality.trim() || null;
      if (input.guestIdType !== undefined) guest.idType = input.guestIdType.trim() || null;
      if (input.guestIdNumber !== undefined) guest.idNumber = input.guestIdNumber.trim() || null;
    }
    guest = await this.guests.save(guest);

    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
    const totalAmount = input.totalAmount != null ? Number(input.totalAmount) : Number(room.rate || 0) * nights;
    if (!Number.isFinite(totalAmount) || totalAmount < 0) throw new BadRequestException('Invalid booking total.');

    const booking = await this.bookings.save(this.bookings.create({
      ownerId,
      roomId: room.id,
      guestId: guest.id,
      hotelId,
      checkIn,
      checkOut,
      guestCount: Math.max(1, Number(input.guestCount) || 1),
      totalAmount,
      currency: room.currency || 'TZS',
      status: 'CONFIRMED',
    }));

    const today = new Date().toISOString().slice(0, 10);
    if (dateOnly(checkIn) <= today && dateOnly(checkOut) > today && room.status === 'available') {
      room.status = 'reserved';
      await this.rooms.save(room);
    }
    return { booking, guest, room };
  }

  async checkIn(ownerId: string, bookingId: string) {
    const booking = await this.bookingForOwner(ownerId, bookingId);
    return this.withRoom(ownerId, booking.roomId, (service) => service.checkInLocked(ownerId, bookingId));
  }

  private async checkInLocked(ownerId: string, bookingId: string) {
    const booking = await this.bookingForOwner(ownerId, bookingId);
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException(`Booking cannot be checked in from ${booking.status}.`);
    }
    const room = await this.roomForOwner(ownerId, booking.roomId);
    if (room.status === 'maintenance') throw new BadRequestException('Room is under maintenance.');
    if (room.status === 'occupied') throw new BadRequestException('Room is already occupied.');
    await this.ensureNoOverlap(ownerId, room.id, new Date(booking.checkIn), new Date(booking.checkOut), booking.id);

    booking.status = 'CHECKED_IN';
    room.status = 'occupied';
    await this.bookings.save(booking);
    await this.rooms.save(room);
    return { booking, room, folio: await this.folio(ownerId, booking.id) };
  }

  async checkOut(ownerId: string, bookingId: string) {
    const booking = await this.bookingForOwner(ownerId, bookingId);
    return this.withRoom(ownerId, booking.roomId, (service) => service.checkOutLocked(ownerId, bookingId));
  }

  private async checkOutLocked(ownerId: string, bookingId: string) {
    const booking = await this.bookingForOwner(ownerId, bookingId);
    if (booking.status !== 'CHECKED_IN') {
      throw new BadRequestException(`Only a checked-in booking can be checked out. Current status: ${booking.status}.`);
    }
    const room = await this.roomForOwner(ownerId, booking.roomId);
    booking.status = 'CHECKED_OUT';
    room.status = 'cleaning' as HotelRoom['status'];
    await this.bookings.save(booking);
    await this.rooms.save(room);
    return { booking, room, folio: await this.folio(ownerId, booking.id) };
  }

  async cancel(ownerId: string, bookingId: string) {
    const booking = await this.bookingForOwner(ownerId, bookingId);
    return this.withRoom(ownerId, booking.roomId, (service) => service.cancelLocked(ownerId, bookingId));
  }

  private async cancelLocked(ownerId: string, bookingId: string) {
    const booking = await this.bookingForOwner(ownerId, bookingId);
    if (booking.status === 'CHECKED_IN') throw new BadRequestException('Check the guest out instead of cancelling an active stay.');
    if (['CHECKED_OUT', 'CANCELLED'].includes(booking.status)) {
      throw new BadRequestException(`Booking is already ${booking.status}.`);
    }
    const room = await this.roomForOwner(ownerId, booking.roomId);
    booking.status = 'CANCELLED';
    if (room.status === 'reserved') room.status = 'available';
    await this.bookings.save(booking);
    await this.rooms.save(room);
    return { booking, room };
  }

  async setRoomStatus(ownerId: string, roomId: string, status: 'available' | 'cleaning' | 'maintenance') {
    const room = await this.roomForOwner(ownerId, roomId);
    if (room.status === 'occupied' && status !== 'maintenance') {
      throw new BadRequestException('Occupied rooms must be checked out before changing their room status.');
    }
    room.status = status as HotelRoom['status'];
    return this.rooms.save(room);
  }

  private paymentMarker(bookingId: string) {
    return `[booking:${bookingId}]`;
  }

  private async paymentRows(ownerId: string, booking: HotelBooking) {
    return this.financials.createQueryBuilder('record')
      .where('record.ownerId = :ownerId', { ownerId })
      .andWhere('record.category = :category', { category: 'room_revenue' })
      .andWhere('record.description LIKE :marker', { marker: `%${this.paymentMarker(booking.id)}%` })
      .orderBy('record.createdAt', 'ASC')
      .getMany();
  }

  /**
   * The reception screen's view of current stays.
   *
   * HotelBooking stores roomId and guestId, so GET /hotel/bookings returns
   * rows the front desk cannot render — no guest name, no room number. The
   * reception UI consequently kept its own local state and check-ins vanished
   * on reopen. This is the joined shape that screen actually needs, resolved
   * server-side in three queries rather than a client-side join per row.
   */
  async reservations(ownerId: string, limit = 200) {
    const bookings = await this.bookings.find({
      where: { ownerId },
      order: { checkIn: 'DESC' },
      take: Math.min(500, Math.max(1, limit)),
    });
    if (!bookings.length) return [];

    const roomIds = [...new Set(bookings.map((booking) => booking.roomId).filter(Boolean))];
    const guestIds = [...new Set(bookings.map((booking) => booking.guestId).filter(Boolean))];
    const [rooms, guests] = await Promise.all([
      roomIds.length ? this.rooms.find({ where: { ownerId, id: In(roomIds) } }) : Promise.resolve([]),
      guestIds.length ? this.guests.find({ where: { ownerId, id: In(guestIds) } }) : Promise.resolve([]),
    ]);
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const guestById = new Map(guests.map((guest) => [guest.id, guest]));

    return bookings.map((booking) => {
      const room = roomById.get(booking.roomId);
      const guest = guestById.get(booking.guestId);
      return {
        bookingId: booking.id,
        status: booking.status,
        roomId: booking.roomId,
        roomNumber: room?.roomNumber ?? '',
        roomType: room?.type ?? '',
        guestName: guest?.name ?? '',
        guestPhone: guest?.phone ?? '',
        guestEmail: guest?.email ?? '',
        guestNationality: guest?.nationality ?? '',
        guestIdNumber: guest?.idNumber ?? '',
        checkIn: dateOnly(new Date(booking.checkIn)),
        checkOut: dateOnly(new Date(booking.checkOut)),
        guestCount: booking.guestCount ?? 1,
        totalAmount: Number(booking.totalAmount || 0),
        currency: booking.currency,
      };
    });
  }

  async folio(ownerId: string, bookingId: string) {
    const booking = await this.bookingForOwner(ownerId, bookingId);
    const rows = await this.paymentRows(ownerId, booking);
    const paid = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return {
      bookingId: booking.id,
      total: Number(booking.totalAmount || 0),
      paid,
      outstanding: Math.max(0, Number(booking.totalAmount || 0) - paid),
      currency: booking.currency,
      payments: rows,
    };
  }

  async recordPayment(ownerId: string, bookingId: string, input: RecordHotelPaymentInput) {
    const booking = await this.bookingForOwner(ownerId, bookingId);
    if (!booking.hotelId) throw new BadRequestException('Booking is not assigned to a hotel property.');
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Payment amount must be positive.');
    const current = await this.folio(ownerId, bookingId);
    if (amount > current.outstanding + 0.0001) {
      throw new BadRequestException(`Payment exceeds outstanding balance of ${current.outstanding} ${current.currency}.`);
    }
    const reference = input.reference?.trim() || '';
    if (reference) {
      const duplicate = await this.financials.createQueryBuilder('record')
        .where('record.ownerId = :ownerId', { ownerId })
        .andWhere('record.description LIKE :marker', { marker: `%${this.paymentMarker(booking.id)}%` })
        .andWhere('record.description LIKE :reference', { reference: `%[ref:${reference}]%` })
        .getOne();
      if (duplicate) throw new BadRequestException('This payment reference is already recorded for the booking.');
    }

    const record = await this.financials.save(this.financials.create({
      ownerId,
      hotelId: booking.hotelId,
      category: 'room_revenue',
      amount,
      currency: booking.currency || 'TZS',
      recordDate: new Date(),
      granularity: 'daily',
      description: `Front desk ${input.method.toLowerCase().replace('_', ' ')} payment ${this.paymentMarker(booking.id)}${reference ? ` [ref:${reference}]` : ''}${input.note?.trim() ? ` ${input.note.trim()}` : ''}`,
    }));
    return { record, folio: await this.folio(ownerId, bookingId) };
  }
}
