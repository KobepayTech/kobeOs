import { MigrationInterface, QueryRunner } from 'typeorm';

export class PropertyListings1794172800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "property_listings" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "title" varchar NOT NULL, "kind" varchar NOT NULL, "offer" varchar NOT NULL,
      "price" numeric(18,2) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS',
      "location" varchar NOT NULL, "bedrooms" int, "bathrooms" int, "areaM2" numeric(12,2),
      "description" text NOT NULL DEFAULT '', "amenities" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "contactPhone" varchar NOT NULL DEFAULT '', "imageUrls" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "published" boolean NOT NULL DEFAULT false
    )`);
    await q.query('CREATE INDEX IF NOT EXISTS "idx_property_listings_owner" ON "property_listings" ("ownerId")');
    await q.query('CREATE INDEX IF NOT EXISTS "idx_property_listings_public" ON "property_listings" ("published", "createdAt")');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS "property_listings"');
  }
}
