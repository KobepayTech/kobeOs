import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import {
  HotelBooking, HotelGuest, HotelMenuItem, HotelOrder, HotelRoom, HotelServiceRequest, HotelTenant,
} from './hotel.entity';
import { HotelGateway } from './hotel.gateway';
import { OwnedCrudService } from '../common/owned.service';
import type {
  CreateBookingDto, CreateOrderDto, CreateTenantDto,
  UpdateBookingDto, UpdateOrderStatusDto, UpdateServiceRequestStatusDto, UpdateTenantDto,
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
  constructor(
    @InjectRepository(HotelOrder) repo: Repository<HotelOrder>,
    @InjectRepository(HotelMenuItem) private readonly menuRepo: Repository<HotelMenuItem>,
    private readonly gateway: HotelGateway,
  ) { super(repo); }

  async placeOrder(ownerId: string, dto: CreateOrderDto): Promise<HotelOrder> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // Resolve station per line: prefer the menu item's station when present.
    const itemIds = dto.items.map((it) => it.menuItemId).filter((x): x is string => !!x);
    const stationById = new Map<string, 'kitchen' | 'bar' | 'other'>();
    if (itemIds.length > 0) {
      const known = await this.menuRepo.find({ where: itemIds.map((id) => ({ id, ownerId })) });
      for (const m of known) stationById.set(m.id, m.station);
    }

    const items = dto.items.map((it) => ({
      menuItemId: it.menuItemId,
      name: it.name,
      qty: it.qty,
      price: it.price,
      station: (it.menuItemId && stationById.get(it.menuItemId)) || it.station || 'kitchen',
    }));
    // DTO prices may arrive as strings when forwarded from TypeORM entities —
    // parse explicitly to avoid string concatenation in the reduce.
    const total = parseFloat(
      items.reduce((sum, it) => sum + parseFloat(String(it.price)) * it.qty, 0).toFixed(4),
    );

    const data: DeepPartial<HotelOrder> = {
      roomNumber: dto.roomNumber,
      locationType: dto.locationType ?? 'room',
      guestName: dto.guestName ?? null,
      items,
      total,
      currency: dto.currency ?? 'TZS',
      status: 'PENDING',
      note: dto.note ?? '',
    };
    const created = await this.create(ownerId, data);
    this.gateway.emitOrder(ownerId, created, 'created');
    return created;
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
    const updated = await this.update(ownerId, id, { status: dto.status });
    this.gateway.emitOrder(ownerId, updated, 'status', order.status);
    return updated;
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
  constructor(
    @InjectRepository(HotelServiceRequest) repo: Repository<HotelServiceRequest>,
    private readonly gateway: HotelGateway,
  ) { super(repo); }

  async create(ownerId: string, data: DeepPartial<HotelServiceRequest>): Promise<HotelServiceRequest> {
    const created = await super.create(ownerId, data);
    this.gateway.emitServiceRequest(ownerId, created, 'created');
    return created;
  }

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
    const updated = await this.update(ownerId, id, { status: dto.status });
    this.gateway.emitServiceRequest(ownerId, updated, 'status', req.status);
    return updated;
  }
}

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(HotelTenant) private readonly repo: Repository<HotelTenant>,
  ) {}

  /** First tenant for this owner (one hotel per operator in v1). */
  async getMine(ownerId: string): Promise<HotelTenant | null> {
    return this.repo.findOne({ where: { ownerId }, order: { createdAt: 'ASC' } });
  }

  async findBySlug(slug: string): Promise<HotelTenant | null> {
    return this.repo.findOne({ where: { slug } });
  }

  async upsertForOwner(ownerId: string, dto: CreateTenantDto): Promise<HotelTenant> {
    const slug = dto.slug.toLowerCase();
    const existingForOwner = await this.getMine(ownerId);
    const slugOwner = await this.findBySlug(slug);
    if (slugOwner && slugOwner.ownerId !== ownerId) {
      throw new BadRequestException(`Slug '${slug}' is already taken`);
    }
    if (existingForOwner) {
      existingForOwner.slug = slug;
      existingForOwner.name = dto.name;
      if (dto.brandColor !== undefined) existingForOwner.brandColor = dto.brandColor ?? null;
      if (dto.logoUrl !== undefined) existingForOwner.logoUrl = dto.logoUrl ?? null;
      if (dto.currency) existingForOwner.currency = dto.currency;
      return this.repo.save(existingForOwner);
    }
    const created = this.repo.create({
      ownerId,
      slug,
      name: dto.name,
      brandColor: dto.brandColor ?? null,
      logoUrl: dto.logoUrl ?? null,
      currency: dto.currency ?? 'TZS',
    });
    return this.repo.save(created);
  }

  async updateMine(ownerId: string, dto: UpdateTenantDto): Promise<HotelTenant> {
    const t = await this.getMine(ownerId);
    if (!t) throw new NotFoundException('No tenant configured');
    if (dto.name !== undefined) t.name = dto.name;
    if (dto.brandColor !== undefined) t.brandColor = dto.brandColor ?? null;
    if (dto.logoUrl !== undefined) t.logoUrl = dto.logoUrl ?? null;
    if (dto.currency !== undefined) t.currency = dto.currency;
    return this.repo.save(t);
  }
}
