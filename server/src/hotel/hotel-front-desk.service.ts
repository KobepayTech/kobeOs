import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelBooking, HotelFinancialRecord, HotelGuest, HotelRoom } from './hotel.entity';

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
    const room = await this.roomForOwner(ownerId, input.roomId);
    if (room.status === 'maintenance') throw new BadRequestException('Room is under maintenance.');
    const { checkIn, checkOut } = this.parseStay(input.checkIn, input.checkOut);
    await this.ensureNoOverlap(ownerId, room.id, checkIn, checkOut);

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
