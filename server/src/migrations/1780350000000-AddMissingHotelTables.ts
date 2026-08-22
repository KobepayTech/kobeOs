import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates hotel_menu_items, hotel_orders and hotel_service_requests.
 *
 * These entities (src/hotel/hotel.entity.ts) only ever existed in dev via
 * TypeORM `synchronize` — no migration created them, so a fresh production
 * DB (synchronize=false, migrations only) never had them, and the later
 * AddHotelIdScoping migration crashed on `relation "hotel_orders" does not
 * exist`. Ordered just before AddHotelIdScoping (1780400000000). Columns
 * mirror the entities; `hotelId` is included so AddHotelIdScoping's
 * ADD COLUMN IF NOT EXISTS becomes a harmless no-op.
 */
export class AddMissingHotelTables1780350000000 implements MigrationInterface {
  name = 'AddMissingHotelTables1780350000000';

  public async up(q: QueryRunner): Promise<void> {
    const base =
      `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
      `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
      `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
      `"ownerId" uuid NOT NULL`;

    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_menu_items" (
      ${base},
      "name" character varying NOT NULL,
      "category" character varying NOT NULL,
      "price" numeric(18,4) NOT NULL DEFAULT 0,
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "available" boolean NOT NULL DEFAULT true,
      "station" character varying NOT NULL DEFAULT 'kitchen',
      "hotelId" uuid,
      CONSTRAINT "PK_hotel_menu_items" PRIMARY KEY ("id")
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_orders" (
      ${base},
      "roomNumber" character varying NOT NULL,
      "locationType" character varying NOT NULL DEFAULT 'room',
      "guestName" character varying,
      "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "total" numeric(18,4) NOT NULL DEFAULT 0,
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "status" character varying NOT NULL DEFAULT 'PENDING',
      "note" character varying NOT NULL DEFAULT '',
      "hotelId" uuid,
      CONSTRAINT "PK_hotel_orders" PRIMARY KEY ("id")
    )`);

    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_service_requests" (
      ${base},
      "roomNumber" character varying NOT NULL,
      "kind" character varying NOT NULL,
      "note" character varying NOT NULL DEFAULT '',
      "status" character varying NOT NULL DEFAULT 'OPEN',
      "hotelId" uuid,
      CONSTRAINT "PK_hotel_service_requests" PRIMARY KEY ("id")
    )`);

    // ownerId + roomNumber indexes (mirror @Index on the entities). The
    // hotelId indexes are created by AddHotelIdScoping.
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_menu_items_owner" ON "hotel_menu_items" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_orders_owner" ON "hotel_orders" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_orders_roomNumber" ON "hotel_orders" ("roomNumber")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_service_requests_owner" ON "hotel_service_requests" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_service_requests_roomNumber" ON "hotel_service_requests" ("roomNumber")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "hotel_service_requests"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_orders"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_menu_items"`);
  }
}
