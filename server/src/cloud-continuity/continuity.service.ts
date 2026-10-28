import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { CloudOutboxRecord, CloudRoomAllotment } from './continuity.entity';
import { ProductSnippet } from '../commerce/commerce.entity';
import { HotelBooking, HotelGuest, HotelRoom } from '../hotel/hotel.entity';
import {
  blocksLocalSale,
  consumeAllowance,
  localSellableQty,
  nextStatus,
  returnAllowance,
  windowsOverlap,
} from './continuity.rules';

export interface CloudBookingPayload {
  roomId: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guestCount?: number;
  /** Pay on arrival in this phase: no amount is captured online. */
  totalAmount?: number;
  currency?: string;
}

const asDate = (value: Date | string): Date => new Date(typeof value === 'string' ? `${value.slice(0, 10)}T00:00:00Z` : value);

/**
 * KobeOS's side of the online continuity layer.
 *
 * It owns the allotment state machine, refuses local sales of capacity the
 * cloud could still commit, and absorbs what the cloud originated — once,
 * however many times the sync is retried.
 */
@Injectable()
export class ContinuityService {
  constructor(
    @InjectRepository(CloudRoomAllotment) private readonly allotments: Repository<CloudRoomAllotment>,
    @InjectRepository(CloudOutboxRecord) private readonly outbox: Repository<CloudOutboxRecord>,
    @InjectRepository(ProductSnippet) private readonly snippets: Repository<ProductSnippet>,
    @InjectRepository(HotelBooking) private readonly bookings: Repository<HotelBooking>,
    @InjectRepository(HotelGuest) private readonly guests: Repository<HotelGuest>,
    @InjectRepository(HotelRoom) private readonly rooms: Repository<HotelRoom>,
    private readonly ds: DataSource,
  ) {}

  // ── rooms ────────────────────────────────────────────────────────────────

  async grantRoom(ownerId: string, input: { hotelId: string; roomId: string; fromDate: string; toDate: string; note?: string }) {
    const from = asDate(input.fromDate);
    const to = asDate(input.toDate);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
      throw new BadRequestException('An allotment needs a start before its end.');
    }
    const room = await this.rooms.findOne({ where: { id: input.roomId, ownerId } });
    if (!room) throw new NotFoundException('Room not found.');

    return this.ds.transaction(async (tx) => {
      // Lock the room row first. HotelFrontDeskService.withRoom locks the same
      // row before it writes a reservation, so this is what stops an allotment
      // and a front-desk booking for the same nights both passing their checks
      // and both succeeding.
      const locked = await tx.getRepository(HotelRoom)
        .findOne({ where: { id: input.roomId, ownerId }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw new NotFoundException('Room not found.');

      const repo = tx.getRepository(CloudRoomAllotment);
      // Two allotments over the same nights would let the cloud sell the room
      // twice to itself.
      const live = await repo.find({ where: { ownerId, roomId: input.roomId }, lock: { mode: 'pessimistic_write' } });
      for (const existing of live) {
        if (!blocksLocalSale(existing.status, existing.acknowledgedAt)) continue;
        if (windowsOverlap(from, to, asDate(existing.fromDate), asDate(existing.toDate))) {
          throw new ConflictException('That room is already allotted online for overlapping dates.');
        }
      }
      // An existing local booking is the operator's own: do not give away
      // nights already sold at the front desk.
      const clash = await tx.getRepository(HotelBooking)
        .createQueryBuilder('b')
        .where('b.ownerId = :ownerId', { ownerId })
        .andWhere('b.roomId = :roomId', { roomId: input.roomId })
        .andWhere(`b.status IN ('PENDING','CONFIRMED','CHECKED_IN')`)
        .andWhere('b."checkIn" < :to AND b."checkOut" > :from', { from, to })
        .getOne();
      if (clash) throw new ConflictException('That room already has a reservation in those dates.');

      return repo.save(repo.create({
        ownerId, hotelId: input.hotelId, roomId: input.roomId,
        fromDate: from, toDate: to, status: 'ACTIVE', note: input.note ?? '',
      }));
    });
  }

  /**
   * Refuse a local sale of nights the cloud owns.
   *
   * Called by the front desk before it writes a reservation. Anything short of
   * an acknowledged release blocks, including an expired window — the cloud may
   * hold a reservation for it and may not be reachable to ask.
   */
  async assertRoomNotAllotted(ownerId: string, roomId: string, checkIn: Date, checkOut: Date): Promise<void> {
    const held = await this.allotments.find({ where: { ownerId, roomId } });
    for (const allotment of held) {
      if (!blocksLocalSale(allotment.status, allotment.acknowledgedAt)) continue;
      if (windowsOverlap(checkIn, checkOut, asDate(allotment.fromDate), asDate(allotment.toDate))) {
        throw new ConflictException(
          'Those nights are allotted to online booking. Reclaim the allotment and wait for it to be released first.',
        );
      }
    }
  }

  /** Ask for capacity back. Does not free it: the cloud must acknowledge. */
  async requestReclaim(ownerId: string, allotmentId: string) {
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(CloudRoomAllotment);
      const allotment = await repo.findOne({ where: { id: allotmentId, ownerId }, lock: { mode: 'pessimistic_write' } });
      if (!allotment) throw new NotFoundException('Allotment not found.');
      const next = nextStatus(allotment.status, 'RECLAIM');
      if (!next) return allotment; // already requested or released
      allotment.status = next;
      allotment.reclaimRequestedAt = new Date();
      return repo.save(allotment);
    });
  }

  /**
   * The cloud confirming it will not commit this capacity. Only this frees it
   * for local sale, and a replayed acknowledgement is a no-op.
   */
  async acknowledgeRelease(ownerId: string, allotmentId: string) {
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(CloudRoomAllotment);
      const allotment = await repo.findOne({ where: { id: allotmentId, ownerId }, lock: { mode: 'pessimistic_write' } });
      if (!allotment) throw new NotFoundException('Allotment not found.');
      const next = nextStatus(allotment.status, 'ACKNOWLEDGE');
      if (!next) return allotment;
      allotment.status = next;
      allotment.acknowledgedAt = new Date();
      return repo.save(allotment);
    });
  }

  // ── products ─────────────────────────────────────────────────────────────

  async allocateProduct(ownerId: string, input: { businessId: string; productId: string; qty: number }) {
    const qty = Math.floor(Number(input.qty));
    if (!Number.isFinite(qty) || qty < 0) throw new BadRequestException('Allocation must be zero or more.');
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(ProductSnippet);
      const snippet = await repo.findOne({
        where: { businessId: input.businessId, productId: input.productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!snippet) throw new NotFoundException('Product is not published online.');
      // Never allot more than the merchant actually reports holding.
      if (qty > Number(snippet.stock)) {
        throw new BadRequestException(`Cannot allot ${qty}; reported stock is ${snippet.stock}.`);
      }
      snippet.allocatedQty = qty;
      snippet.remainingQty = qty;
      return repo.save(snippet);
    });
  }

  /**
   * Spend online allowance. Returns false when the allotment cannot cover it,
   * which is how two simultaneous attempts on the last unit end with one sale.
   * The row lock is what makes that true rather than probable.
   */
  async consumeProductAllowance(businessId: string, productId: string, qty: number): Promise<boolean> {
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(ProductSnippet);
      const snippet = await repo.findOne({
        where: { businessId, productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!snippet) return false;
      const remaining = consumeAllowance(snippet.remainingQty, qty);
      if (remaining === null) return false;
      snippet.remainingQty = remaining;
      await repo.save(snippet);
      return true;
    });
  }

  /** Units the cloud gave back, capped so a replayed release cannot inflate. */
  async returnProductAllowance(businessId: string, productId: string, qty: number) {
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(ProductSnippet);
      const snippet = await repo.findOne({ where: { businessId, productId }, lock: { mode: 'pessimistic_write' } });
      if (!snippet) throw new NotFoundException('Product is not published online.');
      snippet.remainingQty = returnAllowance(snippet.remainingQty, snippet.allocatedQty, qty);
      return repo.save(snippet);
    });
  }

  /** What POS and manual adjustments may still sell. */
  async localSellable(businessId: string, productId: string): Promise<number | null> {
    const snippet = await this.snippets.findOne({ where: { businessId, productId } });
    if (!snippet) return null;
    return localSellableQty({ stock: Number(snippet.stock), remainingQty: Number(snippet.remainingQty) });
  }

  // ── reconciliation ───────────────────────────────────────────────────────

  /**
   * Absorb a booking the cloud took, exactly once.
   *
   * Idempotency rests on the unique index over (ownerId, cloudOriginId) rather
   * than on a prior read, so a retry that races the first attempt still ends
   * with one reservation.
   */
  async absorbCloudBooking(ownerId: string, originId: string, payload: CloudBookingPayload) {
    const existing = await this.bookings.findOne({ where: { ownerId, cloudOriginId: originId } });
    if (existing) return { booking: existing, created: false };

    const room = await this.rooms.findOne({ where: { id: payload.roomId, ownerId } });
    if (!room) throw new NotFoundException('Room not found for a cloud booking.');

    try {
      return await this.ds.transaction(async (tx) => {
        const guestRepo = tx.getRepository(HotelGuest);
        const guest = await guestRepo.save(guestRepo.create({
          ownerId,
          hotelId: room.hotelId ?? payload.roomId,
          name: payload.guestName,
          phone: payload.guestPhone,
        } as Partial<HotelGuest>));

        const repo = tx.getRepository(HotelBooking);
        const booking = await repo.save(repo.create({
          ownerId,
          hotelId: room.hotelId ?? null,
          roomId: payload.roomId,
          guestId: guest.id,
          checkIn: asDate(payload.checkIn),
          checkOut: asDate(payload.checkOut),
          guestCount: payload.guestCount ?? 1,
          // Pay on arrival: the reservation is confirmed, the money is not.
          status: 'CONFIRMED',
          totalAmount: payload.totalAmount ?? 0,
          currency: payload.currency ?? room.currency ?? 'TZS',
          cloudOriginId: originId,
        } as Partial<HotelBooking>));
        return { booking, created: true };
      });
    } catch (error) {
      // The unique index fired: a concurrent retry got there first, which is
      // the outcome we wanted anyway.
      const raced = await this.bookings.findOne({ where: { ownerId, cloudOriginId: originId } });
      if (raced) return { booking: raced, created: false };
      throw error;
    }
  }

  /** Record what the cloud originated. Re-recording the same originId is a no-op. */
  async recordOutbox(ownerId: string, kind: CloudOutboxRecord['kind'], originId: string, payload: unknown) {
    const existing = await this.outbox.findOne({ where: { ownerId, kind, originId } });
    if (existing) return existing;
    try {
      return await this.outbox.save(this.outbox.create({
        ownerId, kind, originId, payload: JSON.stringify(payload ?? {}),
      }));
    } catch {
      const raced = await this.outbox.findOne({ where: { ownerId, kind, originId } });
      if (raced) return raced;
      throw new ConflictException('Could not record the outbox entry.');
    }
  }

  async markSynced(ownerId: string, id: string) {
    await this.outbox.update({ id, ownerId }, { syncedAt: new Date() });
  }

  async pendingOutbox(ownerId: string, limit = 100) {
    // IsNull(), not a bare null: TypeORM drops a null comparison from the
    // where clause, so this returned synced rows as pending and a sync-lag
    // alarm built on it would never have cleared.
    return this.outbox.find({
      where: { ownerId, syncedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: Math.min(500, Math.max(1, limit)),
    });
  }
}
