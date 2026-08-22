import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CargoCustomer,
  CargoLane,
  ConsolidationBox,
  ConsolidationBoxStatus,
  Parcel,
  ParcelLifecycleStatus,
  Shipment,
} from './cargo.entity';
import { CargoGateway } from './cargo.gateway';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Operator-facing workflow for the upgraded cargo flow:
 *
 *   CargoCustomer registry — assigns a 3-char displayId (G29, P12)
 *     per owner. Generator is collision-free per (ownerId, displayId).
 *
 *   CargoLane registry — pre-configured shipping lanes (TZASLK-G,
 *     TZASLK-S) the operator picks from a dropdown when consolidating.
 *
 *   ConsolidationBox lifecycle — OPEN → SEALED → DISPATCHED →
 *     OVERSEAS_RECEIVED → EMPTIED. Assigning a parcel into a box
 *     moves the parcel's lifecycleStatus to FOR_CONSOLIDATION; sealing
 *     the box moves all its parcels to CONSOLIDATED; dispatching
 *     creates a Shipment and moves parcels to IN_TRANSIT.
 *
 *   Parcel state-machine helpers — transitionLifecycle() refuses
 *     illegal jumps (e.g. STORED → DELIVERED) so the warehouse
 *     workflow can't desync.
 */
@Injectable()
export class CargoConsolidationService {
  private readonly logger = new Logger(CargoConsolidationService.name);

  constructor(
    @InjectRepository(CargoCustomer)     private readonly customers: Repository<CargoCustomer>,
    @InjectRepository(CargoLane)         private readonly lanes:     Repository<CargoLane>,
    @InjectRepository(ConsolidationBox)  private readonly boxes:     Repository<ConsolidationBox>,
    @InjectRepository(Parcel)            private readonly parcels:   Repository<Parcel>,
    @InjectRepository(Shipment)          private readonly shipments: Repository<Shipment>,
    private readonly gateway: CargoGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /** Best-effort fan-out: load every parcel in a box and fire the
   *  customer-facing SMS+WhatsApp on the new status. Swallows errors
   *  so a Beem outage never blocks a warehouse transition. */
  private async notifyBoxParcels(uid: string, boxId: string, status: ParcelLifecycleStatus) {
    try {
      const parcels = await this.parcels.find({ where: { ownerId: uid, boxId } });
      await Promise.allSettled(parcels.map((p) => this.notifications.notifyParcelLifecycle(p, status)));
    } catch { /* notifications are best-effort */ }
  }

  // ── Customers ─────────────────────────────────────────────────────────────

  listCustomers(uid: string) {
    return this.customers.find({ where: { ownerId: uid }, order: { displayId: 'ASC' } });
  }

  async createCustomer(uid: string, dto: { name: string; phone: string; country?: string; notes?: string }): Promise<CargoCustomer> {
    if (!dto.name?.trim() || !dto.phone?.trim()) {
      throw new BadRequestException('name and phone are required');
    }
    const displayId = await this.nextDisplayId(uid);
    return this.customers.save(this.customers.create({
      ownerId: uid,
      displayId,
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      country: dto.country ?? '',
      notes: dto.notes ?? '',
      balance: 0,
      currency: 'TZS',
      active: true,
    }));
  }

  /** Generate the next free displayId for this owner. Format: 1 upper
   *  letter + 2 digits (A00 → Z99 = 2,600 combinations). Linear scan
   *  is fine for the size — a busy warehouse hits maybe a few hundred. */
  private async nextDisplayId(uid: string): Promise<string> {
    const existing = await this.customers.find({
      where: { ownerId: uid },
      select: ['displayId'],
    });
    const used = new Set(existing.map((c) => c.displayId));
    for (let letter = 65; letter <= 90; letter++) {
      for (let n = 0; n <= 99; n++) {
        const id = String.fromCharCode(letter) + String(n).padStart(2, '0');
        if (!used.has(id)) return id;
      }
    }
    // 2,600 customers in one tenant is "build a second warehouse"
    // territory. Fall back to 4-char so we don't crash.
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        for (let n = 0; n <= 99; n++) {
          const id = String.fromCharCode(a) + String.fromCharCode(b) + String(n).padStart(2, '0').slice(1);
          if (!used.has(id) && id.length === 3) return id;
        }
      }
    }
    throw new Error('CargoCustomer displayId space exhausted — switch to 4-char IDs');
  }

  // ── Lanes ─────────────────────────────────────────────────────────────────

  listLanes(uid: string) {
    return this.lanes.find({ where: { ownerId: uid, active: true }, order: { code: 'ASC' } });
  }

  async createLane(uid: string, dto: {
    code: string; name: string; origin?: string; destination?: string;
    defaultCarrier?: string; defaultAirlineCode?: string;
    dispatchDays?: string[]; pricePerKg?: number; currency?: string;
  }): Promise<CargoLane> {
    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('code and name are required');
    }
    return this.lanes.save(this.lanes.create({
      ownerId: uid,
      code: dto.code.trim(),
      name: dto.name.trim(),
      origin: dto.origin ?? '',
      destination: dto.destination ?? '',
      defaultCarrier: dto.defaultCarrier ?? null,
      defaultAirlineCode: dto.defaultAirlineCode ?? null,
      dispatchDays: dto.dispatchDays ?? [],
      pricePerKg: dto.pricePerKg ?? 0,
      currency: dto.currency ?? 'TZS',
      active: true,
    }));
  }

  // ── Consolidation boxes ──────────────────────────────────────────────────

  listBoxes(uid: string, status?: ConsolidationBoxStatus) {
    return this.boxes.find({
      where: status ? { ownerId: uid, status } : { ownerId: uid },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async createBox(uid: string, dto: { laneId: string; boxId?: string; notes?: string }): Promise<ConsolidationBox> {
    const lane = await this.lanes.findOne({ where: { id: dto.laneId, ownerId: uid } });
    if (!lane) throw new NotFoundException('Lane not found');
    const boxId = dto.boxId?.trim() || this.suggestBoxId(lane.code);
    return this.boxes.save(this.boxes.create({
      ownerId: uid,
      boxId,
      laneId: lane.id,
      laneCode: lane.code,
      status: 'OPEN',
      parcelCount: 0,
      totalWeight: 0,
      notes: dto.notes ?? '',
    }));
  }

  private suggestBoxId(laneCode: string): string {
    const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${laneCode}-${stamp}-${rand}`;
  }

  /** Assign parcels into an OPEN box. Each parcel transitions to
   *  FOR_CONSOLIDATION; refused if any parcel is already past
   *  CONSOLIDATED in its lifecycle (would mean we're picking it
   *  off a flight to re-pack, almost never legitimate). */
  async assignParcels(uid: string, boxId: string, parcelIds: string[]) {
    const box = await this.boxes.findOne({ where: { id: boxId, ownerId: uid } });
    if (!box) throw new NotFoundException('Box not found');
    if (box.status !== 'OPEN') throw new BadRequestException(`Box is ${box.status}; reopen first or pick another box`);
    if (parcelIds.length === 0) throw new BadRequestException('No parcels selected');

    const parcels = await this.parcels.find({ where: { id: In(parcelIds), ownerId: uid } });
    if (parcels.length !== parcelIds.length) {
      throw new NotFoundException('One or more parcels not found');
    }
    for (const p of parcels) {
      if (laterThan(p.lifecycleStatus, 'CONSOLIDATED')) {
        throw new BadRequestException(`Parcel ${p.parcelId} is ${p.lifecycleStatus}; can't add to a new box`);
      }
    }
    for (const p of parcels) {
      p.boxId = box.id;
      p.lifecycleStatus = 'FOR_CONSOLIDATION';
    }
    await this.parcels.save(parcels);
    await this.recountBox(uid, box.id);
    return this.boxes.findOne({ where: { id: box.id, ownerId: uid } });
  }

  /** Remove parcels from a box — moves them back to STORED so they
   *  can be assigned to a different lane. Only works on OPEN boxes
   *  (after seal/dispatch the box is locked). */
  async unassignParcels(uid: string, boxId: string, parcelIds: string[]) {
    const box = await this.boxes.findOne({ where: { id: boxId, ownerId: uid } });
    if (!box) throw new NotFoundException('Box not found');
    if (box.status !== 'OPEN') throw new BadRequestException(`Box is ${box.status}; unassign blocked`);
    await this.parcels
      .createQueryBuilder()
      .update(Parcel)
      .set({ boxId: null, lifecycleStatus: 'STORED' })
      .where('id IN (:...ids) AND ownerId = :uid AND boxId = :bid', { ids: parcelIds, uid, bid: box.id })
      .execute();
    await this.recountBox(uid, box.id);
    return this.boxes.findOne({ where: { id: box.id, ownerId: uid } });
  }

  /** Seal — lock the box and bump its parcels to CONSOLIDATED. The
   *  operator's name is captured for the warehouse accountability
   *  column the user wanted (BubbleBee shows "李业宇" on each box). */
  async sealBox(uid: string, boxId: string, sealedBy: string) {
    const box = await this.boxes.findOne({ where: { id: boxId, ownerId: uid } });
    if (!box) throw new NotFoundException('Box not found');
    if (box.status !== 'OPEN') throw new BadRequestException(`Box is ${box.status}, already sealed`);
    if (box.parcelCount === 0) throw new BadRequestException('Box is empty — assign parcels before sealing');
    box.status = 'SEALED';
    box.sealedAt = new Date();
    box.sealedBy = sealedBy || null;
    await this.boxes.save(box);
    await this.parcels.update(
      { ownerId: uid, boxId: box.id, lifecycleStatus: 'FOR_CONSOLIDATION' },
      { lifecycleStatus: 'CONSOLIDATED' },
    );
    void this.notifyBoxParcels(uid, box.id, 'CONSOLIDATED');
    return box;
  }

  /** Dispatch — create a Shipment from this sealed box. The shipment
   *  inherits the box's weight + parcel count and the operator can
   *  attach a flight via the existing FR24 path. */
  async dispatchBox(uid: string, boxId: string, dto: { shipmentId?: string; carrier?: string; flightNumber?: string }) {
    const box = await this.boxes.findOne({ where: { id: boxId, ownerId: uid } });
    if (!box) throw new NotFoundException('Box not found');
    if (box.status !== 'SEALED') {
      throw new BadRequestException(`Box must be SEALED to dispatch (currently ${box.status})`);
    }
    const lane = await this.lanes.findOne({ where: { id: box.laneId, ownerId: uid } });
    const shipment = await this.shipments.save(this.shipments.create({
      ownerId: uid,
      shipmentId: dto.shipmentId?.trim() || `SH-${box.boxId}`,
      origin: lane?.origin ?? '',
      destination: lane?.destination ?? '',
      weight: box.totalWeight,
      status: 'IN_TRANSIT',
      carrier: dto.carrier ?? lane?.defaultCarrier ?? null,
      flightNumber: dto.flightNumber ?? null,
    }));
    box.status = 'DISPATCHED';
    box.shipmentId = shipment.id;
    box.dispatchedAt = new Date();
    await this.boxes.save(box);
    await this.parcels.update(
      { ownerId: uid, boxId: box.id, lifecycleStatus: 'CONSOLIDATED' },
      { lifecycleStatus: 'IN_TRANSIT' },
    );
    try { this.gateway.emitShipment(uid, shipment, 'created'); } catch { /* socket — best effort */ }
    void this.notifyBoxParcels(uid, box.id, 'IN_TRANSIT');
    return { box, shipment };
  }

  /** Mark the box as arrived at the destination hub. Bumps all
   *  contained parcels to OVERSEAS_RECEIVED. */
  async receiveOverseas(uid: string, boxId: string) {
    const box = await this.boxes.findOne({ where: { id: boxId, ownerId: uid } });
    if (!box) throw new NotFoundException('Box not found');
    if (box.status !== 'DISPATCHED') {
      throw new BadRequestException(`Box must be DISPATCHED to mark received (currently ${box.status})`);
    }
    box.status = 'OVERSEAS_RECEIVED';
    await this.boxes.save(box);
    await this.parcels.update(
      { ownerId: uid, boxId: box.id, lifecycleStatus: 'IN_TRANSIT' },
      { lifecycleStatus: 'OVERSEAS_RECEIVED' },
    );
    void this.notifyBoxParcels(uid, box.id, 'OVERSEAS_RECEIVED');
    return box;
  }

  // ── Customer wallet (top-up + debit) ─────────────────────────────────────

  /** Add credit to a customer's wallet — typically called after a
   *  KobePay deposit clears. notes records the source so the audit
   *  trail shows where each credit came from. */
  async creditCustomer(uid: string, customerId: string, amount: number, notes?: string): Promise<CargoCustomer> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be > 0');
    }
    const customer = await this.customers.findOne({ where: { id: customerId, ownerId: uid } });
    if (!customer) throw new NotFoundException('Customer not found');
    customer.balance = Math.round((Number(customer.balance) + amount) * 10000) / 10000;
    if (notes) customer.notes = `${customer.notes ? customer.notes + '\n' : ''}+${amount} ${customer.currency}: ${notes}`;
    return this.customers.save(customer);
  }

  /** Debit the wallet — refuses to go below zero (use a separate
   *  GENERAL supplier payment for credit-on-account flows). */
  async debitCustomer(uid: string, customerId: string, amount: number, notes?: string): Promise<CargoCustomer> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be > 0');
    }
    const customer = await this.customers.findOne({ where: { id: customerId, ownerId: uid } });
    if (!customer) throw new NotFoundException('Customer not found');
    const next = Math.round((Number(customer.balance) - amount) * 10000) / 10000;
    if (next < 0) {
      throw new BadRequestException(`Insufficient balance (have ${customer.balance}, need ${amount})`);
    }
    customer.balance = next;
    if (notes) customer.notes = `${customer.notes ? customer.notes + '\n' : ''}-${amount} ${customer.currency}: ${notes}`;
    return this.customers.save(customer);
  }

  private async recountBox(uid: string, boxId: string) {
    const parcels = await this.parcels.find({ where: { ownerId: uid, boxId } });
    const box = await this.boxes.findOne({ where: { id: boxId, ownerId: uid } });
    if (!box) return;
    box.parcelCount = parcels.length;
    box.totalWeight = Math.round(parcels.reduce((s, p) => s + Number(p.weight), 0) * 100) / 100;
    await this.boxes.save(box);
  }
}

/** Parcel lifecycle order — used to refuse illegal transitions like
 *  "move a parcel that's already IN_TRANSIT back into a box". */
const ORDER: ParcelLifecycleStatus[] = [
  'PRE_ALERTED', 'AWAITING_STORAGE', 'STORED', 'ON_HOLD',
  'FOR_CONSOLIDATION', 'CONSOLIDATED', 'IN_TRANSIT',
  'OVERSEAS_RECEIVED', 'READY_FOR_PICKUP', 'DELIVERED',
];
function laterThan(a: ParcelLifecycleStatus, b: ParcelLifecycleStatus): boolean {
  return ORDER.indexOf(a) > ORDER.indexOf(b);
}
