import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import {
  HotelBooking, HotelGuest, HotelMenuItem, HotelOrder, HotelRoom, HotelServiceRequest,
} from './hotel.entity';
import { OwnedCrudService } from '../common/owned.service';
import type {
  CreateBookingDto, CreateOrderDto, UpdateBookingDto, UpdateOrderStatusDto, UpdateServiceRequestStatusDto,
} from './dto/hotel.dto';

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

@Injectable()
export class MenuItemsService extends OwnedCrudService<HotelMenuItem> {
  constructor(@InjectRepository(HotelMenuItem) repo: Repository<HotelMenuItem>) { super(repo); }
}

// Guest orders placed via the QR portal — kitchen/bar staff transition status.
const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService extends OwnedCrudService<HotelOrder> {
  constructor(@InjectRepository(HotelOrder) repo: Repository<HotelOrder>) { super(repo); }

  async placeOrder(ownerId: string, dto: CreateOrderDto): Promise<HotelOrder> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }
    const total = dto.items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const data: DeepPartial<HotelOrder> = {
      roomNumber: dto.roomNumber,
      guestName: dto.guestName ?? null,
      items: dto.items.map((it) => ({
        menuItemId: it.menuItemId,
        name: it.name,
        qty: it.qty,
        price: it.price,
      })),
      total,
      currency: dto.currency ?? 'TZS',
      status: 'PENDING',
      note: dto.note ?? '',
    };
    return this.create(ownerId, data);
  }

  async updateStatus(ownerId: string, id: string, dto: UpdateOrderStatusDto): Promise<HotelOrder> {
    const order = await this.get(ownerId, id);
    const allowed = ORDER_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition order from '${order.status}' to '${dto.status}'. ` +
        `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}`,
      );
    }
    return this.update(ownerId, id, { status: dto.status });
  }
}

const SERVICE_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class ServiceRequestsService extends OwnedCrudService<HotelServiceRequest> {
  constructor(@InjectRepository(HotelServiceRequest) repo: Repository<HotelServiceRequest>) { super(repo); }

  async updateStatus(
    ownerId: string,
    id: string,
    dto: UpdateServiceRequestStatusDto,
  ): Promise<HotelServiceRequest> {
    const req = await this.get(ownerId, id);
    const allowed = SERVICE_TRANSITIONS[req.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition service request from '${req.status}' to '${dto.status}'. ` +
        `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}`,
      );
    }
    return this.update(ownerId, id, { status: dto.status });
  }
}
