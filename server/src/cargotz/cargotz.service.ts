import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CtzParcel, CtzWarehouse, CtzStatusEvent, CtzStaff, CtzStatus, CTZ_STATUSES, CtzRole } from './cargotz.entity';

const num = (v: unknown) => Number(v) || 0;
const pad = (n: number, w = 6) => String(n).padStart(w, '0');
function ymd(d: Date) { return `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`; }

export interface ActorCtx { name: string; role?: CtzRole | 'Owner' }

@Injectable()
export class CargoTzService {
  constructor(
    @InjectRepository(CtzParcel) private readonly parcels: Repository<CtzParcel>,
    @InjectRepository(CtzWarehouse) private readonly warehouse: Repository<CtzWarehouse>,
    @InjectRepository(CtzStatusEvent) private readonly events: Repository<CtzStatusEvent>,
    @InjectRepository(CtzStaff) private readonly staff: Repository<CtzStaff>,
  ) {}

  /* ── Staff / roles ── */

  listStaff(uid: string) {
    return this.staff.find({ where: { ownerId: uid }, order: { role: 'ASC', name: 'ASC' } });
  }
  async createStaff(uid: string, dto: { name: string; role: CtzRole; pin: string; phone?: string; warehouse?: string }) {
    if (!/^\d{4}$/.test(dto.pin)) throw new BadRequestException('Pin must be 4 digits');
    if (await this.staff.findOne({ where: { ownerId: uid, pin: dto.pin } })) throw new BadRequestException('Pin already in use');
    return this.staff.save(this.staff.create({ ownerId: uid, name: dto.name, role: dto.role, pin: dto.pin, phone: dto.phone ?? '', warehouse: dto.warehouse ?? '', active: true }));
  }
  async updateStaff(uid: string, id: string, dto: Partial<CtzStaff>) {
    const s = await this.staff.findOne({ where: { ownerId: uid, id } });
    if (!s) throw new NotFoundException();
    Object.assign(s, dto);
    return this.staff.save(s);
  }
  async removeStaff(uid: string, id: string) {
    const s = await this.staff.findOne({ where: { ownerId: uid, id } });
    if (!s) throw new NotFoundException();
    await this.staff.remove(s);
    return { removed: true };
  }
  async actor(uid: string, pin?: string): Promise<ActorCtx> {
    if (!pin) return { name: 'Owner', role: 'Owner' };
    const s = await this.staff.findOne({ where: { ownerId: uid, pin, active: true } });
    return s ? { name: s.name, role: s.role } : { name: 'Owner', role: 'Owner' };
  }

  /* ── Tracking number ── */

  /** CTZ-YYYYMMDD-NNNNNN, sequence = owner's parcels that day + 1. Globally
   *  unique index catches the rare cross-owner clash → retry bumps it. */
  private async nextTracking(uid: string, offset = 0): Promise<string> {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayCount = await this.parcels
      .createQueryBuilder('p')
      .where('p.ownerId = :uid', { uid })
      .andWhere('p.createdAt >= :d', { d: dayStart })
      .getCount();
    return `CTZ-${ymd(now)}-${pad(todayCount + 1 + offset)}`;
  }

  /* ── Parcel intake (Receiving Agent) ── */

  async createParcel(uid: string, ctx: ActorCtx, dto: {
    senderName: string; senderPhone: string; senderId?: string;
    receiverName: string; receiverPhone: string;
    parcelType?: string; description?: string; quantity?: number; weight?: number; value?: number;
    origin: string; destination: string;
    transportFee?: number; paymentStatus?: 'PAID' | 'UNPAID';
    fragile?: boolean; cashOnDelivery?: boolean; notes?: string; photoUrl?: string;
  }) {
    if (!dto.senderName?.trim() || !dto.senderPhone?.trim()) throw new BadRequestException('Sender name and phone are required');
    if (!dto.receiverName?.trim() || !dto.receiverPhone?.trim()) throw new BadRequestException('Receiver name and phone are required');
    if (!dto.origin?.trim() || !dto.destination?.trim()) throw new BadRequestException('Route (from/to) is required');

    for (let attempt = 0; attempt < 5; attempt++) {
      const trackingNumber = await this.nextTracking(uid, attempt);
      try {
        const parcel = await this.parcels.save(this.parcels.create({
          ownerId: uid, trackingNumber,
          senderName: dto.senderName.trim(), senderPhone: dto.senderPhone.trim(), senderId: dto.senderId ?? '',
          receiverName: dto.receiverName.trim(), receiverPhone: dto.receiverPhone.trim(),
          parcelType: dto.parcelType ?? '', description: dto.description ?? '',
          quantity: dto.quantity ?? 1, weight: num(dto.weight), value: num(dto.value),
          origin: dto.origin.trim(), destination: dto.destination.trim(),
          transportFee: num(dto.transportFee), paymentStatus: dto.paymentStatus ?? 'UNPAID',
          status: 'RECEIVED_AT_SHOP', currentLocation: dto.origin.trim(),
          fragile: !!dto.fragile, cashOnDelivery: !!dto.cashOnDelivery, notes: dto.notes ?? '',
          photoUrl: dto.photoUrl ?? '', receivedByName: ctx.name,
        }));
        await this.addEvent(uid, parcel.id, 'RECEIVED_AT_SHOP', ctx.name, dto.origin.trim(), 'Parcel received from customer');
        return parcel;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
    throw new BadRequestException('Could not allocate a tracking number');
  }

  private addEvent(uid: string, parcelId: string, status: CtzStatus, by: string, location: string, note = '') {
    return this.events.save(this.events.create({ ownerId: uid, parcelId, status, updatedByName: by, location, note }));
  }

  /* ── Lookups ── */

  async list(uid: string, opts: { status?: string; q?: string } = {}) {
    const qb = this.parcels.createQueryBuilder('p').where('p.ownerId = :uid', { uid }).orderBy('p.createdAt', 'DESC').take(500);
    if (opts.status) qb.andWhere('p.status = :s', { s: opts.status });
    if (opts.q?.trim()) {
      const q = `%${opts.q.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(p.trackingNumber) LIKE :q OR LOWER(p.senderName) LIKE :q OR LOWER(p.receiverName) LIKE :q OR LOWER(p.receiverPhone) LIKE :q)', { q });
    }
    return qb.getMany();
  }

  /** Full authed record — parcel + warehouse + timeline. Accepts an id or a
   *  tracking number (the QR scan path). Branch on the key shape: a UUID
   *  matches the id column, anything else is a tracking number (comparing a
   *  non-UUID string against the uuid id column throws in Postgres). */
  async getOne(uid: string, idOrTracking: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrTracking);
    const parcel = await this.parcels.findOne({
      where: isUuid ? { ownerId: uid, id: idOrTracking } : { ownerId: uid, trackingNumber: idOrTracking.toUpperCase() },
    });
    if (!parcel) throw new NotFoundException('Parcel not found');
    const [wh, timeline] = await Promise.all([
      this.warehouse.findOne({ where: { ownerId: uid, parcelId: parcel.id } }),
      this.events.find({ where: { ownerId: uid, parcelId: parcel.id }, order: { createdAt: 'ASC' } }),
    ]);
    return { parcel, warehouse: wh ?? null, timeline };
  }

  /* ── Warehouse packing (scan QR → auto-load → fill warehouse fields) ── */

  async pack(uid: string, ctx: ActorCtx, idOrTracking: string, dto: {
    warehouseLocation?: string; shelfNumber?: string; bagNumber?: string;
    busNumber?: string; driverName?: string; driverPhone?: string;
    departureTime?: string; expectedArrival?: string;
  }) {
    const { parcel } = await this.getOne(uid, idOrTracking);
    let wh = await this.warehouse.findOne({ where: { ownerId: uid, parcelId: parcel.id } });
    if (!wh) wh = this.warehouse.create({ ownerId: uid, parcelId: parcel.id });
    Object.assign(wh, {
      warehouseLocation: dto.warehouseLocation ?? wh.warehouseLocation ?? '',
      shelfNumber: dto.shelfNumber ?? wh.shelfNumber ?? '',
      bagNumber: dto.bagNumber ?? wh.bagNumber ?? '',
      busNumber: dto.busNumber ?? wh.busNumber ?? '',
      driverName: dto.driverName ?? wh.driverName ?? '',
      driverPhone: dto.driverPhone ?? wh.driverPhone ?? '',
      departureTime: dto.departureTime ? new Date(dto.departureTime) : wh.departureTime ?? null,
      expectedArrival: dto.expectedArrival ? new Date(dto.expectedArrival) : wh.expectedArrival ?? null,
      packedBy: ctx.name,
      packedAt: new Date(),
    });
    await this.warehouse.save(wh);
    // Packing implies at least PACKED. Don't regress a further-along parcel.
    if (this.rank(parcel.status) < this.rank('PACKED')) {
      parcel.status = 'PACKED';
      parcel.currentLocation = dto.warehouseLocation || parcel.currentLocation;
      await this.parcels.save(parcel);
      await this.addEvent(uid, parcel.id, 'PACKED', ctx.name, wh.warehouseLocation, `Shelf ${wh.shelfNumber || '—'} · Bag ${wh.bagNumber || '—'}`);
    }
    return this.getOne(uid, parcel.id);
  }

  private rank(s: string) { return CTZ_STATUSES.indexOf(s as CtzStatus); }

  /* ── Advance status (any stage; appends to timeline) ── */

  async advance(uid: string, ctx: ActorCtx, idOrTracking: string, dto: { status: CtzStatus; location?: string; note?: string }) {
    if (!CTZ_STATUSES.includes(dto.status)) throw new BadRequestException('Invalid status');
    const { parcel } = await this.getOne(uid, idOrTracking);
    parcel.status = dto.status;
    if (dto.location) parcel.currentLocation = dto.location;
    if (dto.status === 'DELIVERED') parcel.paymentStatus = parcel.paymentStatus; // no-op hook
    await this.parcels.save(parcel);
    await this.addEvent(uid, parcel.id, dto.status, ctx.name, dto.location ?? parcel.currentLocation, dto.note ?? '');
    return this.getOne(uid, parcel.id);
  }

  async setPayment(uid: string, ctx: ActorCtx, idOrTracking: string, paid: boolean) {
    const { parcel } = await this.getOne(uid, idOrTracking);
    parcel.paymentStatus = paid ? 'PAID' : 'UNPAID';
    await this.parcels.save(parcel);
    await this.addEvent(uid, parcel.id, parcel.status, ctx.name, parcel.currentLocation, paid ? 'Payment collected' : 'Marked unpaid');
    return parcel;
  }

  /* ── Owner dashboard ── */

  async dashboard(uid: string) {
    const all = await this.parcels.find({ where: { ownerId: uid }, take: 10000 });
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inState = (s: CtzStatus[]) => all.filter((p) => s.includes(p.status));
    const sumFee = (rows: CtzParcel[]) => rows.reduce((a, p) => a + num(p.transportFee), 0);

    const receivedToday = all.filter((p) => new Date(p.createdAt) >= dayStart).length;
    const dispatched = inState(['LOADED', 'IN_TRANSIT']);
    const delivered = inState(['DELIVERED']);
    const paid = all.filter((p) => p.paymentStatus === 'PAID');
    const unpaid = all.filter((p) => p.paymentStatus === 'UNPAID');

    // Last 14 days trend (count + revenue).
    const trend: { date: string; parcels: number; revenue: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const de = new Date(ds); de.setDate(de.getDate() + 1);
      const rows = all.filter((p) => { const t = new Date(p.createdAt); return t >= ds && t < de; });
      trend.push({ date: `${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`, parcels: rows.length, revenue: sumFee(rows.filter((r) => r.paymentStatus === 'PAID')) });
    }

    const byStatus = CTZ_STATUSES.map((s) => ({ status: s, count: all.filter((p) => p.status === s).length })).filter((x) => x.count > 0);

    return {
      cards: {
        receivedToday,
        inWarehouse: inState(['AT_WAREHOUSE', 'PACKED']).length,
        dispatched: dispatched.length,
        delivered: delivered.length,
        cashCollected: sumFee(paid),
        outstanding: sumFee(unpaid),
        totalParcels: all.length,
      },
      byStatus,
      trend,
    };
  }

  /* ── Public tracking (no auth; tracking number is the key) ── */

  async track(trackingNumber: string) {
    const parcel = await this.parcels.findOne({ where: { trackingNumber: trackingNumber.toUpperCase() } });
    if (!parcel) throw new NotFoundException('Tracking number not found');
    const [wh, timeline] = await Promise.all([
      this.warehouse.findOne({ where: { parcelId: parcel.id } }),
      this.events.find({ where: { parcelId: parcel.id }, order: { createdAt: 'ASC' } }),
    ]);
    return {
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      currentLocation: parcel.currentLocation,
      origin: parcel.origin, destination: parcel.destination,
      senderName: parcel.senderName, receiverName: parcel.receiverName,
      description: parcel.description, quantity: parcel.quantity,
      paymentStatus: parcel.paymentStatus,
      bus: wh ? { busNumber: wh.busNumber, driverName: wh.driverName, departureTime: wh.departureTime, expectedArrival: wh.expectedArrival } : null,
      timeline: timeline.map((e) => ({ status: e.status, location: e.location, note: e.note, at: e.createdAt })),
      createdAt: parcel.createdAt,
    };
  }
}
