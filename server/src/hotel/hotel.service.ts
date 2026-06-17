import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';
import {
  HotelBooking, HotelGuest, HotelMenuItem, HotelOrder, HotelRoom, HotelServiceRequest, HotelTenant,
  HotelChain, HotelParkingSpot, HotelFinancialRecord,
} from './hotel.entity';
import { HotelGateway } from './hotel.gateway';
import { OwnedCrudService } from '../common/owned.service';
import type {
  CreateBookingDto, CreateOrderDto, CreateTenantDto,
  UpdateBookingDto, UpdateOrderStatusDto, UpdateServiceRequestStatusDto, UpdateTenantDto,
} from './dto/hotel.dto';
import type {
  CreateHotelChainDto, CreateFinancialRecordDto, CreateParkingSpotDto, HotelAggregationQueryDto, UpdateParkingSpotDto,
} from './dto/hotel-extras.dto';

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
    @InjectRepository(HotelRoom) private readonly roomRepo: Repository<HotelRoom>,
    @InjectRepository(HotelBooking) private readonly bookingRepo: Repository<HotelBooking>,
  ) {}

  /** Primary tenant — kept for back-compat with single-hotel callers (the QR
   *  portal, public guest pages). New multi-property code should call
   *  {@link listMine} instead. */
  async getMine(ownerId: string): Promise<HotelTenant | null> {
    return this.repo.findOne({ where: { ownerId }, order: { createdAt: 'ASC' } });
  }

  /** Every tenant owned by the caller — the multi-property switcher list. */
  async listMine(ownerId: string): Promise<HotelTenant[]> {
    return this.repo.find({ where: { ownerId }, order: { createdAt: 'ASC' } });
  }

  async findBySlug(slug: string): Promise<HotelTenant | null> {
    return this.repo.findOne({ where: { slug } });
  }

  /** Upsert the primary tenant for this owner. Preserved so single-hotel
   *  callers (the QR portal flow) keep working unchanged. */
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

  /** Insert a brand new property (never upserts) — supports owners running
   *  multiple hotels under one account. */
  async createProperty(ownerId: string, dto: CreateTenantDto): Promise<HotelTenant> {
    const slug = dto.slug.toLowerCase();
    const slugOwner = await this.findBySlug(slug);
    if (slugOwner) {
      throw new BadRequestException(`Slug '${slug}' is already taken`);
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

  /** Per-property aggregates for the "All Properties" dashboard.
   *  Joins each tenant the caller owns with derived KPIs from rooms +
   *  bookings (today's check-ins / check-outs / revenue). Untagged legacy
   *  rooms (hotelId is null) are excluded so they don't double-count when an
   *  owner hasn't migrated their data yet. */
  async portfolio(ownerId: string): Promise<PortfolioEntry[]> {
    const tenants = await this.listMine(ownerId);
    if (tenants.length === 0) return [];

    const today = new Date().toISOString().slice(0, 10);

    return Promise.all(
      tenants.map(async (t) => {
        const rooms = await this.roomRepo.find({ where: { ownerId, hotelId: t.id } });
        const roomsTotal = rooms.length;
        const occupied   = rooms.filter((r) => r.status === 'occupied').length;
        const maintenance = rooms.filter((r) => r.status === 'maintenance').length;

        // Today's check-ins / check-outs (date columns are stored as YYYY-MM-DD).
        const todayCheckIn = await this.bookingRepo
          .createQueryBuilder('b')
          .where('b.ownerId = :ownerId', { ownerId })
          .andWhere('b.hotelId = :hotelId', { hotelId: t.id })
          .andWhere("to_char(b.checkIn, 'YYYY-MM-DD') = :today", { today })
          .getCount();
        const todayCheckOut = await this.bookingRepo
          .createQueryBuilder('b')
          .where('b.ownerId = :ownerId', { ownerId })
          .andWhere('b.hotelId = :hotelId', { hotelId: t.id })
          .andWhere("to_char(b.checkOut, 'YYYY-MM-DD') = :today", { today })
          .getCount();

        // Revenue today: sum of bookings whose checkIn is today and that
        // are CONFIRMED or CHECKED_IN.
        const revRow = await this.bookingRepo
          .createQueryBuilder('b')
          .select('COALESCE(SUM(b.totalAmount), 0)', 'sum')
          .where('b.ownerId = :ownerId', { ownerId })
          .andWhere('b.hotelId = :hotelId', { hotelId: t.id })
          .andWhere("to_char(b.checkIn, 'YYYY-MM-DD') = :today", { today })
          .andWhere("b.status IN ('CONFIRMED', 'CHECKED_IN')")
          .getRawOne<{ sum: string }>();
        const revenueToday = revRow ? parseFloat(revRow.sum ?? '0') : 0;

        const occupancyRate = roomsTotal > 0 ? Math.round((occupied / roomsTotal) * 100) : 0;
        const adr     = occupied > 0  ? Math.round(revenueToday / occupied)  : 0;
        const revPar  = roomsTotal > 0 ? Math.round(revenueToday / roomsTotal) : 0;

        return {
          id: t.id,
          slug: t.slug,
          name: t.name,
          brandColor: t.brandColor ?? null,
          logoUrl: t.logoUrl ?? null,
          currency: t.currency,
          roomsTotal,
          occupied,
          occupancyRate,
          todayCheckIn,
          todayCheckOut,
          revenueToday,
          adr,
          revPar,
          alerts: maintenance,
        };
      }),
    );
  }
}

export interface PortfolioEntry {
  id: string;
  slug: string;
  name: string;
  brandColor: string | null;
  logoUrl: string | null;
  currency: string;
  roomsTotal: number;
  occupied: number;
  occupancyRate: number;
  todayCheckIn: number;
  todayCheckOut: number;
  revenueToday: number;
  adr: number;
  revPar: number;
  alerts: number;
}

/* ─────────────── Multi-Hotel Services ─────────────── */

@Injectable()
export class HotelChainService {
  constructor(
    @InjectRepository(HotelChain) private readonly chainRepo: Repository<HotelChain>,
    @InjectRepository(HotelTenant) private readonly tenantRepo: Repository<HotelTenant>,
    @InjectRepository(HotelRoom) private readonly roomRepo: Repository<HotelRoom>,
    @InjectRepository(HotelBooking) private readonly bookingRepo: Repository<HotelBooking>,
    @InjectRepository(HotelGuest) private readonly guestRepo: Repository<HotelGuest>,
    @InjectRepository(HotelFinancialRecord) private readonly financialRepo: Repository<HotelFinancialRecord>,
  ) {}

  /** Get all chains owned by the user. */
  async getChains(ownerId: string): Promise<HotelChain[]> {
    return this.chainRepo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  /** Create a new hotel chain. */
  async createChain(ownerId: string, dto: CreateHotelChainDto): Promise<HotelChain> {
    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.chainRepo.findOne({ where: { slug } });
    if (existing) {
      throw new BadRequestException(`Chain slug '${slug}' is already taken`);
    }
    const chain = this.chainRepo.create({
      ownerId,
      slug,
      name: dto.name,
      description: dto.description,
      currency: dto.currency ?? 'TZS',
      brandColor: dto.brandColor ?? '#7B8CDE',
      isActive: true,
    });
    return this.chainRepo.save(chain);
  }

  /** Get all hotels belonging to a chain.
   *  For v1, hotels are linked via the chain's slug prefix in their slug or
   *  by a future chainId column. Here we filter by owner (all owner's hotels).
   */
  async getChainHotels(ownerId: string, chainId: string): Promise<HotelTenant[]> {
    const chain = await this.chainRepo.findOne({ where: { id: chainId, ownerId } });
    if (!chain) throw new NotFoundException('Chain not found');
    return this.tenantRepo.find({ where: { ownerId }, order: { createdAt: 'ASC' } });
  }

  /** Admin dashboard aggregation: totals across all hotels + per-hotel breakdown. */
  async getAdminDashboard(ownerId: string, query: HotelAggregationQueryDto): Promise<Record<string, unknown>> {
    // Base where conditions for date filtering on bookings and financials
    const fromDate = query.from ? new Date(query.from) : undefined;
    const toDate = query.to ? new Date(query.to) : undefined;

    // ── Hotel count ──
    const totalHotels = await this.tenantRepo.count({ where: { ownerId } });

    // ── Room count ──
    const totalRooms = await this.roomRepo.count({ where: { ownerId } });

    // ── Occupancy: rooms currently occupied ──
    const occupiedRooms = await this.roomRepo.count({ where: { ownerId, status: 'occupied' } });
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // ── Guest count ──
    const totalGuests = await this.guestRepo.count({ where: { ownerId } });

    // ── Active bookings count ──
    const activeBookings = await this.bookingRepo.count({
      where: { ownerId, status: 'CONFIRMED' },
    });

    // ── Financial summary ──
    const finWhere: FindOptionsWhere<HotelFinancialRecord> = { ownerId };
    if (query.hotelId) finWhere.hotelId = query.hotelId;
    if (fromDate || toDate) {
      // Use query builder for date range
      const qb = this.financialRepo.createQueryBuilder('f')
        .where('f.ownerId = :ownerId', { ownerId });
      if (query.hotelId) qb.andWhere('f.hotelId = :hotelId', { hotelId: query.hotelId });
      if (fromDate) qb.andWhere('f.recordDate >= :fromDate', { fromDate });
      if (toDate) qb.andWhere('f.recordDate <= :toDate', { toDate });
      const financials = await qb.getMany();
      const revenue = financials
        .filter((f) => f.category.includes('revenue'))
        .reduce((sum, f) => sum + parseFloat(String(f.amount)), 0);
      const expenses = financials
        .filter((f) => f.category.includes('expense'))
        .reduce((sum, f) => sum + parseFloat(String(f.amount)), 0);

      // ── Per-hotel breakdown ──
      const hotels = await this.tenantRepo.find({ where: { ownerId } });
      const perHotel = await Promise.all(
        hotels.map(async (h) => {
          const rooms = await this.roomRepo.count({ where: { ownerId, id: undefined } });
          const hotelRooms = await this.roomRepo.find({ where: { ownerId } });
          const hotelRoomIds = hotelRooms.map((r) => r.id);
          const hOccupied = hotelRooms.filter((r) => r.status === 'occupied').length;
          const hOccupancy = rooms > 0 ? Math.round((hOccupied / rooms) * 100) : 0;
          const hGuests = await this.guestRepo.count({ where: { ownerId } });
          const hBookings = await this.bookingRepo.count({ where: { ownerId, status: 'CONFIRMED' } });
          return {
            hotelId: h.id,
            name: h.name,
            slug: h.slug,
            roomCount: rooms,
            occupiedRooms: hOccupied,
            occupancyRate: hOccupancy,
            guestCount: hGuests,
            activeBookings: hBookings,
          };
        }),
      );

      return {
        summary: {
          totalHotels,
          totalRooms,
          occupiedRooms,
          occupancyRate,
          totalGuests,
          activeBookings,
          revenue,
          expenses,
          netRevenue: revenue - expenses,
        },
        perHotel,
        dateRange: { from: query.from ?? null, to: query.to ?? null },
      };
    }

    // Without date range — simpler aggregation
    const financials = await this.financialRepo.find({ where: finWhere });
    const revenue = financials
      .filter((f) => f.category.includes('revenue'))
      .reduce((sum, f) => sum + parseFloat(String(f.amount)), 0);
    const expenses = financials
      .filter((f) => f.category.includes('expense'))
      .reduce((sum, f) => sum + parseFloat(String(f.amount)), 0);

    // ── Per-hotel breakdown ──
    const hotels = await this.tenantRepo.find({ where: { ownerId } });
    const perHotel = await Promise.all(
      hotels.map(async (h) => {
        const hotelRooms = await this.roomRepo.find({ where: { ownerId } });
        const rooms = hotelRooms.length;
        const hOccupied = hotelRooms.filter((r) => r.status === 'occupied').length;
        const hOccupancy = rooms > 0 ? Math.round((hOccupied / rooms) * 100) : 0;
        const hGuests = await this.guestRepo.count({ where: { ownerId } });
        const hBookings = await this.bookingRepo.count({ where: { ownerId, status: 'CONFIRMED' } });
        return {
          hotelId: h.id,
          name: h.name,
          slug: h.slug,
          roomCount: rooms,
          occupiedRooms: hOccupied,
          occupancyRate: hOccupancy,
          guestCount: hGuests,
          activeBookings: hBookings,
        };
      }),
    );

    return {
      summary: {
        totalHotels,
        totalRooms,
        occupiedRooms,
        occupancyRate,
        totalGuests,
        activeBookings,
        revenue,
        expenses,
        netRevenue: revenue - expenses,
      },
      perHotel,
      dateRange: { from: query.from ?? null, to: query.to ?? null },
    };
  }

  /* ── Parking ── */
  async getParkingSpots(hotelId: string): Promise<HotelParkingSpot[]> {
    return this.roomRepo.manager.getRepository(HotelParkingSpot).find({
      where: { hotelId },
      order: { createdAt: 'DESC' },
    });
  }

  async createParkingSpot(dto: CreateParkingSpotDto): Promise<HotelParkingSpot> {
    const repo = this.roomRepo.manager.getRepository(HotelParkingSpot);
    const spot = repo.create({
      hotelId: dto.hotelId,
      spotNumber: dto.spotNumber,
      type: dto.type,
      status: 'free',
      ratePerDay: dto.ratePerDay ?? 0,
    });
    return repo.save(spot);
  }

  async updateParkingSpot(id: string, dto: UpdateParkingSpotDto): Promise<HotelParkingSpot> {
    const repo = this.roomRepo.manager.getRepository(HotelParkingSpot);
    const spot = await repo.findOne({ where: { id } });
    if (!spot) throw new NotFoundException('Parking spot not found');
    if (dto.status !== undefined) spot.status = dto.status;
    if (dto.vehiclePlate !== undefined) spot.vehiclePlate = dto.vehiclePlate;
    if (dto.vehicleModel !== undefined) spot.vehicleModel = dto.vehicleModel;
    if (dto.guestId !== undefined) spot.guestId = dto.guestId;
    if (dto.reservedUntil !== undefined) spot.reservedUntil = dto.reservedUntil;
    return repo.save(spot);
  }

  /* ── Financials ── */
  async getFinancials(hotelId: string, query: HotelAggregationQueryDto): Promise<HotelFinancialRecord[]> {
    const where: FindOptionsWhere<HotelFinancialRecord> = { hotelId };
    if (query.from || query.to) {
      const qb = this.financialRepo.createQueryBuilder('f')
        .where('f.hotelId = :hotelId', { hotelId });
      if (query.from) qb.andWhere('f.recordDate >= :from', { from: query.from });
      if (query.to) qb.andWhere('f.recordDate <= :to', { to: query.to });
      return qb.orderBy('f.recordDate', 'DESC').getMany();
    }
    return this.financialRepo.find({ where, order: { recordDate: 'DESC' } });
  }

  async createFinancialRecord(dto: CreateFinancialRecordDto): Promise<HotelFinancialRecord> {
    const record = this.financialRepo.create({
      hotelId: dto.hotelId,
      category: dto.category,
      amount: dto.amount,
      currency: dto.currency ?? 'TZS',
      description: dto.description ?? '',
      recordDate: dto.recordDate ?? new Date(),
      granularity: dto.granularity ?? 'daily',
    });
    return this.financialRepo.save(record);
  }
}
