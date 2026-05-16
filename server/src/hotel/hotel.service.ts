import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelBooking, HotelGuest, HotelRoom } from './hotel.entity';
import { OwnedCrudService } from '../common/owned.service';
import type { CreateBookingDto, UpdateBookingDto } from './dto/hotel.dto';

@Injectable()
export class RoomsService extends OwnedCrudService<HotelRoom> {
  constructor(@InjectRepository(HotelRoom) repo: Repository<HotelRoom>) { super(repo); }
}

@Injectable()
export class GuestsService extends OwnedCrudService<HotelGuest> {
  constructor(@InjectRepository(HotelGuest) repo: Repository<HotelGuest>) { super(repo); }
}

@Injectable()
export class BookingsService extends OwnedCrudService<HotelBooking> {
  constructor(
    @InjectRepository(HotelBooking) repo: Repository<HotelBooking>,
    @InjectRepository(HotelRoom) private readonly roomRepo: Repository<HotelRoom>,
  ) {
    super(repo);
  }

  /**
   * Create a booking after verifying:
   * - Room belongs to this owner and exists.
   * - Room is not already booked for the requested date range (overlapping
   *   active bookings: PENDING, CONFIRMED, CHECKED_IN).
   * - checkOut is after checkIn.
   * Marks the room as 'reserved' on success.
   */
  async createBooking(ownerId: string, dto: CreateBookingDto): Promise<HotelBooking> {
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);

    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const room = await this.roomRepo.findOne({ where: { id: dto.roomId, ownerId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status === 'maintenance') {
      throw new BadRequestException('Room is under maintenance and cannot be booked');
    }

    // Check for overlapping bookings on this room.
    // Overlap condition: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
    const conflict = await this.repo
      .createQueryBuilder('b')
      .where('b.roomId = :roomId', { roomId: dto.roomId })
      .andWhere('b.ownerId = :ownerId', { ownerId })
      .andWhere("b.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')")
      .andWhere('b.checkIn < :checkOut', { checkOut })
      .andWhere('b.checkOut > :checkIn', { checkIn })
      .getOne();

    if (conflict) {
      throw new BadRequestException(
        `Room is already booked from ${conflict.checkIn} to ${conflict.checkOut}`,
      );
    }

    const booking = await this.create(ownerId, {
      roomId: dto.roomId,
      guestId: dto.guestId,
      checkIn,
      checkOut,
      guestCount: dto.guestCount ?? 1,
      totalAmount: dto.totalAmount ?? 0,
      currency: dto.currency ?? room.currency,
      status: 'CONFIRMED',
    });

    // Mark room as reserved.
    room.status = 'reserved';
    await this.roomRepo.save(room);

    return booking;
  }

  /**
   * Update a booking. When status transitions to CHECKED_OUT or CANCELLED,
   * restore the room to 'available'.
   */
  async updateBooking(ownerId: string, id: string, dto: UpdateBookingDto): Promise<HotelBooking> {
    const booking = await this.get(ownerId, id);
    const terminalStatuses = ['CHECKED_OUT', 'CANCELLED'];
    const wasActive = !terminalStatuses.includes(booking.status);
    const becomesTerminal = dto.status && terminalStatuses.includes(dto.status);

    const updated = await this.update(ownerId, id, dto);

    if (wasActive && becomesTerminal) {
      const room = await this.roomRepo.findOne({ where: { id: booking.roomId, ownerId } });
      if (room) {
        room.status = 'available';
        await this.roomRepo.save(room);
      }
    }

    return updated;
  }
}
