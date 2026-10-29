import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { CloudOutboxRecord, CloudRoomAllotment } from './continuity.entity';
import type { OutboxKind as OutboxKindValue, SyncSeverity } from './continuity.rules';
import { ProductSnippet } from '../commerce/commerce.entity';
import { PosProduct } from '../pos/pos.entity';
import { HotelBooking, HotelGuest, HotelRoom } from '../hotel/hotel.entity';
import {
  blocksLocalSale,
  consumeAllowance,
  localSellableQty,
  nextStatus,
  returnAllowance,
  syncLagSeverity,
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
      // An allotment may only be resized while nothing is in flight: a
      // committed unit is already promised to an online customer and resizing
      // around it would either strand it or double-count it.
      if (Number(snippet.committedQty) > 0) {
        throw new BadRequestException(
          `Cannot change the allotment while ${snippet.committedQty} online sale(s) are waiting to sync.`,
        );
      }
      snippet.allocatedQty = qty;
      snippet.remainingQty = qty;
      snippet.committedQty = 0;
      return repo.save(snippet);
    });
  }

  /**
   * Spend online allowance. Returns false when the allotment cannot cover it,
   * which is how two simultaneous attempts on the last unit end with one sale.
   * The row lock is what makes that true rather than probable.
   *
   * The units move from remainingQty into committedQty rather than
   * disappearing. remainingQty + committedQty is what the shelf holds back, so
   * it stays constant across the sale — otherwise the hold is released the
   * moment the cloud sells, and the till can take the same unit in the window
   * before the order syncs back.
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
      const moved = Number(snippet.remainingQty) - remaining;
      snippet.remainingQty = remaining;
      snippet.committedQty = Number(snippet.committedQty) + moved;
      await repo.save(snippet);
      return true;
    });
  }

  /**
   * The online order's stock deduction has landed, so the unit is accounted for
   * in `stock` and no longer needs holding separately.
   */
  async settleCommitted(businessId: string, productId: string, qty: number) {
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(ProductSnippet);
      const snippet = await repo.findOne({ where: { businessId, productId }, lock: { mode: 'pessimistic_write' } });
      if (!snippet) throw new NotFoundException('Product is not published online.');
      snippet.committedQty = Math.max(0, Number(snippet.committedQty) - Math.max(0, Math.floor(Number(qty))));
      return repo.save(snippet);
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

  /**
   * What POS and manual adjustments may still sell.
   *
   * Stock comes from pos_products, not from the snippet. The snippet's `stock`
   * is a mirror maintained for the cloud's benefit and only refreshed by a node
   * heartbeat, so it does not follow a till sale — reading it here reported
   * units on a shelf that was already empty.
   */
  async localSellable(businessId: string, productId: string): Promise<number | null> {
    const snippet = await this.snippets.findOne({ where: { businessId, productId } });
    if (!snippet) return null;
    const product = await this.ds.getRepository(PosProduct).findOne({ where: { id: productId } });
    if (product) {
      return localSellableQty({
        stock: Number(product.stock),
        remainingQty: Number(snippet.remainingQty),
        committedQty: Number(snippet.committedQty),
      });
    }
    return localSellableQty({
      stock: Number(snippet.stock),
      remainingQty: Number(snippet.remainingQty),
      committedQty: Number(snippet.committedQty),
    });
  }


  /**
   * Claim an outbox slot for this originId, returning false when someone
   * already has it.
   *
   * ON CONFLICT DO NOTHING rather than insert-and-catch: a unique violation
   * aborts the whole PostgreSQL transaction, so catching it and then querying
   * fails with "current transaction is aborted". That is exactly what the
   * retried-cancellation tests hit.
   */
  private async claimOutboxSlot(
    tx: import('typeorm').EntityManager,
    ownerId: string,
    kind: OutboxKindValue,
    originId: string,
    payload: unknown,
  ): Promise<{ claimed: boolean; id: string | null }> {
    const rows: Array<{ id: string }> = await tx.query(
      `INSERT INTO "cloud_outbox" ("ownerId", "kind", "originId", "payload")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("ownerId", "kind", "originId") DO NOTHING
       RETURNING "id"`,
      [ownerId, kind, originId, JSON.stringify(payload ?? {})],
    );
    return { claimed: rows.length > 0, id: rows[0]?.id ?? null };
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

        // A cancellation can reach us before the booking it cancels — nothing
        // orders the two, and a failed pass retries them independently. The
        // claim row left waiting is applied here, so out-of-order delivery
        // cannot leave a live reservation for a guest who already cancelled.
        const outboxRepo = tx.getRepository(CloudOutboxRecord);
        const earlyCancellation = await outboxRepo.findOne({
          where: { ownerId, kind: 'CANCELLATION', originId },
        });
        if (earlyCancellation && !earlyCancellation.syncedAt) {
          booking.status = 'CANCELLED';
          await repo.save(booking);
          earlyCancellation.syncedAt = new Date();
          earlyCancellation.lastError = '';
          await outboxRepo.save(earlyCancellation);
          return { booking, created: true, cancelledOnArrival: true };
        }
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

  /**
   * Absorb a cancellation the cloud made, exactly once.
   *
   * Keyed on the booking's own origin id, so one booking can only ever be
   * cancelled once however many times the sync retries. The claim row is
   * inserted first and the unique index decides the winner, rather than a read
   * followed by a decision.
   *
   * A guest who has already checked in is not quietly cancelled. That is a
   * conflict between two things that both really happened, so it is recorded
   * on the claim for staff and the booking is left alone — the design's
   * exception queue rather than a sync that fails forever or a reservation
   * that disappears under someone standing at the desk.
   */
  async absorbCloudCancellation(ownerId: string, bookingOriginId: string, reason = '') {
    return this.ds.transaction(async (tx) => {
      const outboxRepo = tx.getRepository(CloudOutboxRecord);
      const slot = await this.claimOutboxSlot(tx, ownerId, 'CANCELLATION', bookingOriginId, { reason });
      if (!slot.claimed) {
        return { cancelled: false, alreadyHandled: true, conflict: false };
      }
      const claimed = await outboxRepo.findOneByOrFail({ id: slot.id as string });

      const bookings = tx.getRepository(HotelBooking);
      const booking = await bookings.findOne({
        where: { ownerId, cloudOriginId: bookingOriginId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) {
        // The cancellation arrived before the booking. The claim stays, so
        // when the booking does land it is already cancelled rather than
        // becoming a live reservation nobody wants.
        claimed.lastError = 'booking_not_yet_synced';
        await outboxRepo.save(claimed);
        return { cancelled: false, alreadyHandled: false, conflict: false };
      }

      if (booking.status === 'CHECKED_IN') {
        claimed.lastError = 'guest_already_checked_in';
        await outboxRepo.save(claimed);
        return { cancelled: false, alreadyHandled: false, conflict: true, booking };
      }
      if (booking.status === 'CANCELLED' || booking.status === 'CHECKED_OUT') {
        return { cancelled: false, alreadyHandled: true, conflict: false, booking };
      }

      booking.status = 'CANCELLED';
      await bookings.save(booking);

      // Hand the room back to whoever it was reserved for. The nights return
      // to the allotment, not to the front desk: the allotment still owns them
      // and the cloud may resell them.
      const rooms = tx.getRepository(HotelRoom);
      const room = await rooms.findOne({ where: { id: booking.roomId, ownerId } });
      if (room && room.status === 'reserved') {
        room.status = 'available';
        await rooms.save(room);
      }

      claimed.syncedAt = new Date();
      await outboxRepo.save(claimed);
      return { cancelled: true, alreadyHandled: false, conflict: false, booking };
    });
  }

  /**
   * Return an online order's units to the allotment, exactly once.
   *
   * The claim row is what makes it once: returnAllowance alone is idempotent
   * in the sense of being capped, but two retries of a one-unit cancellation
   * would still return two units up to that cap.
   */
  async absorbCloudOrderCancellation(
    ownerId: string,
    orderOriginId: string,
    input: { businessId: string; productId: string; qty: number },
  ) {
    return this.ds.transaction(async (tx) => {
      const slot = await this.claimOutboxSlot(tx, ownerId, 'CANCELLATION', orderOriginId, input);
      if (!slot.claimed) return { returned: false, alreadyHandled: true };
      const outboxRepo = tx.getRepository(CloudOutboxRecord);
      // Settle the claim as it is applied. It stays as the dedup key and as
      // evidence, but an applied row must not sit in the unsynced backlog:
      // /api/health reads that count, and a permanent false critical is worse
      // than no alert at all.
      const settle = async (lastError: string) => {
        await outboxRepo.update(slot.id as string, { syncedAt: new Date(), lastError });
      };

      const repo = tx.getRepository(ProductSnippet);
      const snippet = await repo.findOne({
        where: { businessId: input.businessId, productId: input.productId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!snippet) {
        // The product is gone from the mirror; there is nothing to return and
        // no later pass will change that.
        await settle('product_not_found');
        return { returned: false, alreadyHandled: false };
      }
      // Move the units back out of committed: they were promised to an online
      // customer who has cancelled, so they return to the allotment rather
      // than appearing as extra capacity.
      const give = Math.min(Math.max(0, Math.floor(Number(input.qty))), Number(snippet.committedQty));
      snippet.committedQty = Number(snippet.committedQty) - give;
      snippet.remainingQty = returnAllowance(snippet.remainingQty, snippet.allocatedQty, give);
      await repo.save(snippet);
      await settle('');
      return { returned: true, alreadyHandled: false };
    });
  }


  /**
   * How far behind the online transaction backlog is.
   *
   * One aggregate query, because /api/health polls this constantly — Electron
   * boot, the frontend's health hook and the Cloudflare tunnel all hit it.
   *
   * Returns 'unknown' rather than throwing when the continuity tables are
   * absent: an older database, or one migrated before this feature, must not
   * make the liveness endpoint fail.
   */
  async syncHealth(): Promise<{
    status: SyncSeverity;
    pending: number;
    oldestAgeSeconds: number | null;
  }> {
    try {
      const row = await this.outbox
        .createQueryBuilder('o')
        .select('COUNT(*)::int', 'pending')
        .addSelect('MIN(o."createdAt")', 'oldest')
        .where('o."syncedAt" IS NULL')
        .getRawOne<{ pending: number; oldest: Date | null }>();

      const pending = Number(row?.pending ?? 0);
      const oldest = row?.oldest ? new Date(row.oldest) : null;
      const oldestAgeMs = oldest ? Date.now() - oldest.getTime() : null;
      return {
        status: syncLagSeverity({ pending, oldestAgeMs }),
        pending,
        oldestAgeSeconds: oldestAgeMs === null ? null : Math.round(oldestAgeMs / 1000),
      };
    } catch {
      return { status: 'unknown', pending: 0, oldestAgeSeconds: null };
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
