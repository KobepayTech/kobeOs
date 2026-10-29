import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CloudOutboxRecord, CloudRoomAllotment } from './continuity.entity';
import { ProductSnippet } from '../commerce/commerce.entity';
import { HotelRoom, HotelTenant } from '../hotel/hotel.entity';
import { ContinuityService, type CloudBookingPayload } from './continuity.service';
import { blocksLocalSale } from './continuity.rules';

/**
 * What the origin sends the cloud so it has something to sell.
 *
 * Catalogue only, and only the parts online selling needs. Nothing here
 * identifies a guest: no names, no phone numbers, no ID documents — see
 * docs/HOTEL_BIOMETRIC_RETENTION.md and the privacy section of
 * docs/ONLINE_CONTINUITY.md.
 */
export interface CatalogueSnapshot {
  hotels: Array<{ id: string; ownerId: string; name: string; slug: string; currency: string }>;
  rooms: Array<{
    id: string; ownerId: string; hotelId: string | null; roomNumber: string;
    type: string; rate: number; currency: string; capacity: number;
  }>;
  allotments: Array<{
    id: string; ownerId: string; hotelId: string; roomId: string;
    fromDate: string; toDate: string;
  }>;
  products: Array<{
    businessId: string; productId: string; catalogOwnerId: string; name: string;
    price: number; currency: string; stock: number;
    allocatedQty: number; remainingQty: number; committedQty: number;
    active: boolean; imageUrl: string;
  }>;
  takenAt: string;
}

/** A pending transaction as the cloud hands it over. */
export interface OutboxItem {
  id: string;
  ownerId: string;
  kind: CloudOutboxRecord['kind'];
  originId: string;
  payload: unknown;
  createdAt: string;
}

/**
 * How the origin talks to the cloud. Injectable so the whole loop can be
 * driven in one process against a real database in tests, rather than only
 * against a deployed peer.
 */
export interface SyncTransport {
  pushCatalogue(snapshot: CatalogueSnapshot): Promise<void>;
  pullOutbox(limit: number): Promise<OutboxItem[]>;
  acknowledge(ids: string[]): Promise<void>;
}

const dateOnly = (value: Date | string) => String(value).slice(0, 10);

@Injectable()
export class ContinuitySyncService {
  private readonly logger = new Logger('ContinuitySync');

  constructor(
    @InjectRepository(HotelTenant) private readonly hotels: Repository<HotelTenant>,
    @InjectRepository(HotelRoom) private readonly rooms: Repository<HotelRoom>,
    @InjectRepository(CloudRoomAllotment) private readonly allotments: Repository<CloudRoomAllotment>,
    @InjectRepository(ProductSnippet) private readonly snippets: Repository<ProductSnippet>,
    @InjectRepository(CloudOutboxRecord) private readonly outbox: Repository<CloudOutboxRecord>,
    private readonly continuity: ContinuityService,
    private readonly ds: DataSource,
  ) {}

  // ── origin side: build and send ──────────────────────────────────────────

  /**
   * Everything the cloud needs, restricted to inventory actually allotted to
   * it.
   *
   * Only rooms with a live allotment and products with a non-zero allowance
   * are sent. A cloud holding the full catalogue would be able to offer
   * inventory the origin never gave it, which is the overselling the allotment
   * model exists to prevent — and it would copy more data than the job needs.
   */
  async buildCatalogueSnapshot(): Promise<CatalogueSnapshot> {
    const liveAllotments = (await this.allotments.find())
      .filter((a) => blocksLocalSale(a.status, a.acknowledgedAt));

    const roomIds = [...new Set(liveAllotments.map((a) => a.roomId))];
    const rooms = roomIds.length ? await this.rooms.find({ where: { id: In(roomIds) } }) : [];
    const hotelIds = [...new Set(rooms.map((r) => r.hotelId).filter((id): id is string => Boolean(id)))];
    const hotels = hotelIds.length ? await this.hotels.find({ where: { id: In(hotelIds) } }) : [];

    // A product is sellable online only while the cloud still holds allowance
    // for it; committed units are already promised and need no new offer.
    const products = (await this.snippets.find()).filter((s) => Number(s.remainingQty) > 0);

    return {
      takenAt: new Date().toISOString(),
      hotels: hotels.map((h) => ({
        id: h.id, ownerId: h.ownerId, name: h.name,
        slug: (h as unknown as { slug?: string }).slug ?? '',
        currency: (h as unknown as { currency?: string }).currency ?? 'TZS',
      })),
      rooms: rooms.map((r) => ({
        id: r.id, ownerId: r.ownerId, hotelId: r.hotelId ?? null,
        roomNumber: r.roomNumber, type: r.type, rate: Number(r.rate),
        currency: r.currency, capacity: Number(r.capacity),
      })),
      allotments: liveAllotments.map((a) => ({
        id: a.id, ownerId: a.ownerId, hotelId: a.hotelId, roomId: a.roomId,
        fromDate: dateOnly(a.fromDate), toDate: dateOnly(a.toDate),
      })),
      products: products.map((s) => ({
        businessId: s.businessId, productId: s.productId, catalogOwnerId: s.catalogOwnerId,
        name: s.name, price: Number(s.price), currency: s.currency, stock: Number(s.stock),
        allocatedQty: Number(s.allocatedQty), remainingQty: Number(s.remainingQty),
        committedQty: Number(s.committedQty), active: Boolean(s.active),
        imageUrl: s.imageUrl ?? '',
      })),
    };
  }

  /**
   * Run one sync pass: send the catalogue, then take back whatever the cloud
   * originated.
   *
   * Absorption is acknowledged only for items that actually landed. An item
   * that fails is left unacknowledged so the next pass retries it, and
   * absorbCloudBooking is idempotent, so a retry cannot duplicate.
   */
  async runOnce(transport: SyncTransport, limit = 100): Promise<{
    cataloguePushed: boolean;
    pulled: number;
    absorbed: number;
    failed: number;
  }> {
    let cataloguePushed = false;
    try {
      await transport.pushCatalogue(await this.buildCatalogueSnapshot());
      cataloguePushed = true;
    } catch (error) {
      // A catalogue that fails to send is not a reason to skip collecting
      // transactions: those are money already taken.
      this.logger.warn(`catalogue push failed: ${String((error as Error)?.message).slice(0, 200)}`);
    }

    let items: OutboxItem[] = [];
    try {
      items = await transport.pullOutbox(limit);
    } catch (error) {
      this.logger.warn(`outbox pull failed: ${String((error as Error)?.message).slice(0, 200)}`);
      return { cataloguePushed, pulled: 0, absorbed: 0, failed: 0 };
    }

    const settled: string[] = [];
    let failed = 0;
    for (const item of items) {
      try {
        await this.absorb(item);
        settled.push(item.id);
      } catch (error) {
        failed += 1;
        this.logger.error(
          `absorb failed kind=${item.kind} origin=${item.originId}: ${String((error as Error)?.message).slice(0, 200)}`,
        );
      }
    }

    if (settled.length) {
      try {
        await transport.acknowledge(settled);
      } catch (error) {
        // The work landed but the acknowledgement did not, so the cloud will
        // offer these again. Idempotent absorption is what makes that safe.
        this.logger.warn(`acknowledge failed: ${String((error as Error)?.message).slice(0, 200)}`);
      }
    }

    return { cataloguePushed, pulled: items.length, absorbed: settled.length, failed };
  }

  private async absorb(item: OutboxItem): Promise<void> {
    if (item.kind === 'BOOKING') {
      await this.continuity.absorbCloudBooking(
        item.ownerId, item.originId, item.payload as CloudBookingPayload,
      );
      return;
    }
    if (item.kind === 'CANCELLATION') {
      const payload = (item.payload ?? {}) as Record<string, unknown>;
      // An order cancellation names a product; a booking cancellation does not.
      if (typeof payload.productId === 'string' && typeof payload.businessId === 'string') {
        await this.continuity.absorbCloudOrderCancellation(item.ownerId, item.originId, {
          businessId: payload.businessId,
          productId: payload.productId,
          qty: Number(payload.qty ?? 1),
        });
        return;
      }
      await this.continuity.absorbCloudCancellation(
        item.ownerId, item.originId, String(payload.reason ?? ''),
      );
      return;
    }
    // ORDER and ALLOTMENT_RELEASE are not absorbed yet. Thrown rather than
    // silently acknowledged: leaving the row unacknowledged keeps the evidence
    // on the cloud instead of dropping a customer's order on the floor.
    throw new Error(`unsupported outbox kind ${item.kind}`);
  }

  // ── cloud side: receive and serve ────────────────────────────────────────

  /**
   * Apply a catalogue snapshot. Upsert by primary key, so repeated pushes
   * converge rather than accumulate.
   *
   * remainingQty and committedQty are deliberately NOT overwritten on a
   * product the cloud already knows: the cloud is authoritative for what it
   * has sold, and taking the origin's figure would resurrect allowance the
   * cloud already spent — the same defect committedQty was added to prevent,
   * arriving by a different route.
   */
  async applyCatalogueSnapshot(snapshot: CatalogueSnapshot): Promise<{
    hotels: number; rooms: number; allotments: number; products: number;
  }> {
    return this.ds.transaction(async (tx) => {
      for (const hotel of snapshot.hotels ?? []) {
        // slug is NOT NULL and unique, so it has to be carried; it is not
        // updated on conflict because a public URL that moves under a guest
        // mid-outage would break links already handed out.
        await tx.query(
          `INSERT INTO hotel_tenants (id, "ownerId", slug, name, currency)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, currency = EXCLUDED.currency`,
          [hotel.id, hotel.ownerId, hotel.slug || `hotel-${hotel.id.slice(0, 8)}`,
            hotel.name, hotel.currency || 'TZS'],
        );
      }
      for (const room of snapshot.rooms ?? []) {
        await tx.query(
          `INSERT INTO hotel_rooms (id, "ownerId", "hotelId", "roomNumber", type, rate, currency, capacity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             "roomNumber" = EXCLUDED."roomNumber", type = EXCLUDED.type,
             rate = EXCLUDED.rate, currency = EXCLUDED.currency,
             capacity = EXCLUDED.capacity`,
          [room.id, room.ownerId, room.hotelId, room.roomNumber, room.type,
            room.rate, room.currency, room.capacity],
        );
      }
      for (const allotment of snapshot.allotments ?? []) {
        await tx.query(
          `INSERT INTO cloud_room_allotments (id, "ownerId", "hotelId", "roomId", "fromDate", "toDate", status)
           VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
           ON CONFLICT (id) DO UPDATE SET
             "fromDate" = EXCLUDED."fromDate", "toDate" = EXCLUDED."toDate"`,
          [allotment.id, allotment.ownerId, allotment.hotelId, allotment.roomId,
            allotment.fromDate, allotment.toDate],
        );
      }
      for (const product of snapshot.products ?? []) {
        await tx.query(
          `INSERT INTO commerce_product_snippets
             ("businessId", "productId", "catalogOwnerId", name, price, currency, stock,
              "allocatedQty", "remainingQty", "committedQty", active, "imageUrl", "indexedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
           ON CONFLICT ("businessId", "productId") DO UPDATE SET
             name = EXCLUDED.name, price = EXCLUDED.price, currency = EXCLUDED.currency,
             stock = EXCLUDED.stock, "allocatedQty" = EXCLUDED."allocatedQty",
             active = EXCLUDED.active, "imageUrl" = EXCLUDED."imageUrl",
             "indexedAt" = now()`,
          [product.businessId, product.productId, product.catalogOwnerId, product.name,
            product.price, product.currency, product.stock, product.allocatedQty,
            product.remainingQty, product.committedQty, product.active, product.imageUrl],
        );
      }
      return {
        hotels: snapshot.hotels?.length ?? 0,
        rooms: snapshot.rooms?.length ?? 0,
        allotments: snapshot.allotments?.length ?? 0,
        products: snapshot.products?.length ?? 0,
      };
    });
  }

  /** Transactions the origin has not taken back yet, oldest first. */
  async pendingForPeer(limit = 100): Promise<OutboxItem[]> {
    const rows = await this.outbox
      .createQueryBuilder('o')
      .where('o."syncedAt" IS NULL')
      .orderBy('o."createdAt"', 'ASC')
      .take(Math.min(500, Math.max(1, limit)))
      .getMany();

    return rows.map((row) => ({
      id: row.id,
      ownerId: row.ownerId,
      kind: row.kind,
      originId: row.originId,
      payload: safeParse(row.payload),
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  /** Mark handed-over transactions as synced. */
  async acknowledgeForPeer(ids: string[]): Promise<number> {
    const wanted = (ids ?? []).filter((id) => typeof id === 'string' && id).slice(0, 500);
    if (!wanted.length) return 0;
    const result = await this.outbox
      .createQueryBuilder()
      .update(CloudOutboxRecord)
      .set({ syncedAt: () => 'now()' })
      .where('id IN (:...ids) AND "syncedAt" IS NULL', { ids: wanted })
      .execute();
    return result.affected ?? 0;
  }
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value ?? '{}');
  } catch {
    return {};
  }
}
