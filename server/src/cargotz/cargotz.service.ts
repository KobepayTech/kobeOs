import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { CtzParcel, CtzWarehouse, CtzStatusEvent, CtzStaff, CtzStatus, CTZ_STATUSES, CtzRole, CtzCollectorAccess } from './cargotz.entity';

import { cargoBranchKey } from './cargotz-trip.entity';

type IntakeScope = { name: string; branch?: string };

const inviteHash = (token: string) => createHash('sha256').update(token).digest('hex');
const collectorCompany = ({ id, companyName, agentName, agentPhone }: CtzCollectorAccess) =>
  ({ id, companyName, agentName, agentPhone });

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
    @InjectRepository(CtzCollectorAccess) private readonly collectors: Repository<CtzCollectorAccess>,
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

  async listCollectorInvites(uid: string) {
    const rows = await this.collectors.find({
      where: { ownerId: uid, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => ({
      ...collectorCompany(row),
      accepted: !!row.collectorId,
      expiresAt: row.expiresAt,
    }));
  }

  async inviteCollector(uid: string, dto: { companyName: string; agentName: string; agentPhone: string }) {
    if (process.env.KOBEOS_DESKTOP === 'true') {
      throw new BadRequestException('Open hosted CargoTZ to invite agents outside this device');
    }
    const token = randomBytes(32).toString('hex');
    const row = await this.collectors.save(this.collectors.create({
      ownerId: uid,
      companyName: dto.companyName.trim(),
      agentName: dto.agentName.trim(),
      agentPhone: dto.agentPhone.trim(),
      tokenHash: inviteHash(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }));
    return { id: row.id, token, expiresAt: row.expiresAt };
  }

  async revokeCollector(uid: string, id: string) {
    const result = await this.collectors.update({ ownerId: uid, id, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!result.affected) throw new NotFoundException('Collector access not found');
    return { revoked: true };
  }

  async acceptCollectorInvite(uid: string, token: string) {
    return this.collectors.manager.transaction(async (manager) => {
      const repo = manager.getRepository(CtzCollectorAccess);
      const row = await repo.findOne({
        where: { tokenHash: inviteHash(token), revokedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row || (row.collectorId ? row.collectorId !== uid : row.expiresAt.getTime() <= Date.now())) {
        throw new NotFoundException('This invitation is unavailable or expired');
      }
      if (!row.collectorId) await repo.update(row.id, { collectorId: uid });
      return collectorCompany(row);
    });
  }

  async collectorCompanies(uid: string) {
    const rows = await this.collectors.find({
      where: { collectorId: uid, revokedAt: IsNull() },
      order: { companyName: 'ASC' },
    });
    return rows.map(collectorCompany);
  }

  async submitCollection(uid: string, dto: {
    accessId: string; requestId: string; ownerName: string; ownerPhone: string;
    receiverName?: string; receiverPhone?: string; origin: string; destination: string;
    description: string; cartonCount: number; handoff: 'PICKUP' | 'DROPOFF'; handoffLocation: string;
  }) {
    if (!!dto.receiverName !== !!dto.receiverPhone) {
      throw new BadRequestException('Enter both the recipient name and phone, or leave both blank');
    }
    return this.collectors.manager.transaction(async (manager) => {
      const access = await manager.getRepository(CtzCollectorAccess).findOne({
        where: { id: dto.accessId, collectorId: uid, revokedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!access) throw new ForbiddenException('You do not have access to this cargo company');
      const parcels = manager.getRepository(CtzParcel);
      const events = manager.getRepository(CtzStatusEvent);
      const where = { ownerId: access.ownerId, collectorAccessId: access.id, collectionId: dto.requestId };
      let rows = await parcels.find({ where, order: { cartonNumber: 'ASC' } });
      if (!rows.length) {
        const origin = dto.origin.trim();
        const destination = dto.destination.trim();
        const senderName = dto.ownerName.trim();
        const senderPhone = dto.ownerPhone.trim();
        const notes = `${dto.handoff === 'PICKUP' ? 'Pickup requested' : 'Agent drop-off'} · ${dto.handoffLocation.trim()}`;
        rows = await parcels.save(Array.from({ length: dto.cartonCount }, (_, index) => parcels.create({
          ...where,
          trackingNumber: `CTZ-${ymd(new Date())}-${randomBytes(10).toString('hex').toUpperCase()}`,
          cartonNumber: index + 1,
          cartonCount: dto.cartonCount,
          senderName,
          senderPhone,
          receiverName: dto.receiverName?.trim() || senderName,
          receiverPhone: dto.receiverPhone?.trim() || senderPhone,
          description: dto.description.trim(),
          origin,
          destination,
          currentLocation: origin,
          status: 'AWAITING_HANDOFF',
          notes,
        })));
        await events.save(rows.map((parcel) => events.create({
          ownerId: access.ownerId,
          parcelId: parcel.id,
          status: 'AWAITING_HANDOFF',
          updatedByName: access.agentName,
          location: origin,
        })));
      }
      return rows.map(({ trackingNumber, origin, destination, cartonNumber, cartonCount }) =>
        ({ trackingNumber, origin, destination, cartonNumber, cartonCount }));
    });
  }

  private async intakeActor(uid: string, pin?: string) {
    if (!pin) return 'Owner';
    const staff = await this.staff.findOne({ where: { ownerId: uid, pin, active: true } });
    if (!staff || !['Owner', 'Agent'].includes(staff.role)) {
      throw new ForbiddenException('Enter a valid CargoTZ intake staff PIN');
    }
    return staff.name;
  }

  async pendingHandoffs(uid: string, pin?: string, scope?: IntakeScope) {
    if (!scope) await this.intakeActor(uid, pin);
    const query = this.parcels.createQueryBuilder('p')
      .where("p.ownerId = :uid AND p.status = 'AWAITING_HANDOFF'", { uid })
      .orderBy('p.createdAt', 'ASC').addOrderBy('p.cartonNumber', 'ASC').take(100);
    if (scope?.branch) query.andWhere("LOWER(REGEXP_REPLACE(TRIM(p.origin), '[[:space:]]+', ' ', 'g')) = :branch", { branch: cargoBranchKey(scope.branch) });
    return query.getMany();
  }

  async handoff(uid: string, pin: string | undefined, tracking: string, scope?: IntakeScope) {
    if (!scope) await this.intakeActor(uid, pin);
    const parcel = await this.parcels.findOne({
      where: { ownerId: uid, trackingNumber: tracking.trim().toUpperCase() },
    });
    if (!parcel?.collectorAccessId || (scope?.branch && cargoBranchKey(parcel.origin) !== cargoBranchKey(scope.branch))) {
      throw new NotFoundException('Collector parcel not found at this branch');
    }
    const [access, cartons] = await Promise.all([
      this.collectors.findOne({ where: { id: parcel.collectorAccessId, ownerId: uid } }),
      parcel.collectionId ? this.parcels.find({
        where: { ownerId: uid, collectorAccessId: parcel.collectorAccessId, collectionId: parcel.collectionId },
        select: { trackingNumber: true, cartonNumber: true, status: true },
        order: { cartonNumber: 'ASC' },
      }) : [parcel],
    ]);
    return {
      parcel,
      collector: access ? collectorCompany(access) : null,
      cartons: cartons.map(({ trackingNumber, cartonNumber, status }) => ({ trackingNumber, cartonNumber, status })),
    };
  }

  async confirmHandoff(uid: string, pin: string | undefined, tracking: string, measurements: {
    weight?: number; lengthCm?: number; widthCm?: number; heightCm?: number; note?: string;
  }, scope?: IntakeScope) {
    const receivedByName = scope?.name ?? await this.intakeActor(uid, pin);
    return this.parcels.manager.transaction(async (manager) => {
      const parcels = manager.getRepository(CtzParcel);
      const events = manager.getRepository(CtzStatusEvent);
      const parcel = await parcels.findOne({
        where: { ownerId: uid, trackingNumber: tracking.trim().toUpperCase() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!parcel?.collectorAccessId || (scope?.branch && cargoBranchKey(parcel.origin) !== cargoBranchKey(scope.branch))) {
        throw new NotFoundException('Collector parcel not found at this branch');
      }
      if (parcel.status === 'RECEIVED_AT_SHOP') return parcel;
      if (parcel.status !== 'AWAITING_HANDOFF') {
        throw new BadRequestException('This parcel is no longer awaiting handoff');
      }
      const { note, weight, lengthCm, widthCm, heightCm } = measurements;
      parcel.weight = weight ?? parcel.weight;
      parcel.lengthCm = lengthCm ?? parcel.lengthCm;
      parcel.widthCm = widthCm ?? parcel.widthCm;
      parcel.heightCm = heightCm ?? parcel.heightCm;
      parcel.receivedByName = receivedByName;
      parcel.status = 'RECEIVED_AT_SHOP';
      await parcels.save(parcel);
      await events.save(events.create({
        ownerId: uid,
        parcelId: parcel.id,
        status: 'RECEIVED_AT_SHOP',
        updatedByName: receivedByName,
        location: parcel.origin,
        note: note?.trim() || 'Custody accepted by cargo intake',
      }));
      return parcel;
    });
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

  private async lockLegacyParcel(tx: EntityManager, uid: string, idOrTracking: string) {
    const isUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(idOrTracking);
    const parcel = await tx.getRepository(CtzParcel).findOne({
      where: isUuid ? { ownerId: uid, id: idOrTracking } : { ownerId: uid, trackingNumber: idOrTracking.toUpperCase() },
      lock: { mode: 'pessimistic_write' },
    });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (parcel.status === 'AWAITING_HANDOFF') throw new BadRequestException('Intake must accept custody first');
    return parcel;
  }

  /* ── Warehouse packing (scan QR → auto-load → fill warehouse fields) ── */

  async pack(uid: string, ctx: ActorCtx, idOrTracking: string, dto: {
    warehouseLocation?: string; shelfNumber?: string; bagNumber?: string;
    busNumber?: string; driverName?: string; driverPhone?: string;
    departureTime?: string; expectedArrival?: string;
  }) {
    const id = await this.parcels.manager.transaction(async (tx) => {
      const parcel = await this.lockLegacyParcel(tx, uid, idOrTracking);
      if (parcel.tripId) throw new BadRequestException('This carton is managed by its trip manifest');
      const warehouse = tx.getRepository(CtzWarehouse);
      let wh = await warehouse.findOne({ where: { ownerId: uid, parcelId: parcel.id } });
      if (!wh) wh = warehouse.create({ ownerId: uid, parcelId: parcel.id });
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
      await warehouse.save(wh);
      // Packing implies at least PACKED. Don't regress a further-along parcel.
      if (this.rank(parcel.status) < this.rank('PACKED')) {
        parcel.status = 'PACKED';
        parcel.currentLocation = dto.warehouseLocation || parcel.currentLocation;
        await tx.getRepository(CtzParcel).save(parcel);
        await tx.getRepository(CtzStatusEvent).insert({
          ownerId: uid, parcelId: parcel.id, status: 'PACKED', updatedByName: ctx.name,
          location: wh.warehouseLocation, note: `Shelf ${wh.shelfNumber || '—'} · Bag ${wh.bagNumber || '—'}`,
        });
      }
      return parcel.id;
    });
    return this.getOne(uid, id);
  }

  private rank(s: string) { return CTZ_STATUSES.indexOf(s as CtzStatus); }

  /* ── Advance status (any stage; appends to timeline) ── */

  async advance(uid: string, ctx: ActorCtx, idOrTracking: string, dto: { status: CtzStatus; location?: string; note?: string }) {
    if (dto.status === 'AWAITING_HANDOFF' || !CTZ_STATUSES.includes(dto.status)) throw new BadRequestException('Invalid status');
    const id = await this.parcels.manager.transaction(async (tx) => {
      const parcel = await this.lockLegacyParcel(tx, uid, idOrTracking);
      if (parcel.tripId) throw new BadRequestException('This carton is managed by its trip manifest');
      parcel.status = dto.status;
      if (dto.location) parcel.currentLocation = dto.location;
      await tx.getRepository(CtzParcel).save(parcel);
      await tx.getRepository(CtzStatusEvent).insert({
        ownerId: uid, parcelId: parcel.id, status: dto.status, updatedByName: ctx.name,
        location: parcel.currentLocation, note: dto.note ?? '',
      });
      return parcel.id;
    });
    return this.getOne(uid, id);
  }

  setPayment(uid: string, ctx: ActorCtx, idOrTracking: string, paid: boolean) {
    return this.parcels.manager.transaction(async (tx) => {
      const parcel = await this.lockLegacyParcel(tx, uid, idOrTracking);
      parcel.paymentStatus = paid ? 'PAID' : 'UNPAID';
      await tx.getRepository(CtzParcel).update(parcel.id, { paymentStatus: parcel.paymentStatus });
      await tx.getRepository(CtzStatusEvent).insert({
        ownerId: uid, parcelId: parcel.id, status: parcel.status, updatedByName: ctx.name,
        location: parcel.currentLocation, note: paid ? 'Payment collected' : 'Marked unpaid',
      });
      return parcel;
    });
  }

  /* ── Owner dashboard ── */

  async dashboard(uid: string) {
    const all = await this.parcels.find({ where: { ownerId: uid }, take: 10000 });
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inState = (s: CtzStatus[]) => all.filter((p) => s.includes(p.status));
    const sumFee = (rows: CtzParcel[]) => rows.reduce((a, p) => a + num(p.transportFee), 0);

    const receivedToday = await this.events.createQueryBuilder('event')
      .select('COUNT(DISTINCT event.parcelId)', 'count')
      .where('event.ownerId = :uid AND event.status = :status AND event.createdAt >= :dayStart', {
        uid, status: 'RECEIVED_AT_SHOP', dayStart,
      })
      .getRawOne<{ count: string }>()
      .then((result) => Number(result?.count ?? 0));
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
    const timeline = await this.events.find({
      where: { ownerId: parcel.ownerId, parcelId: parcel.id },
      order: { createdAt: 'ASC' },
    });
    return {
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      origin: parcel.origin,
      destination: parcel.destination,
      cartonNumber: parcel.cartonNumber,
      cartonCount: parcel.cartonCount,
      timeline: timeline.map(({ status, createdAt }) => ({ status, at: createdAt })),
      createdAt: parcel.createdAt,
    };
  }
}
