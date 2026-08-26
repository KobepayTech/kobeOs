import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creator commerce attribution spine: shareable creator links, click/order/sale
 * events, and sales-based commissions. Plus product-linking columns on campaigns
 * and creator-attribution columns on Jumla merchant orders.
 */
export class CreatorCommerceAttribution1783900000000 implements MigrationInterface {
  name = 'CreatorCommerceAttribution1783900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "creator_attribution_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "code" varchar NOT NULL,
        "campaignId" uuid,
        "creatorId" uuid NOT NULL,
        "productId" uuid,
        "destination" varchar NOT NULL DEFAULT 'jumla',
        "destinationUrl" text NOT NULL DEFAULT '',
        "commissionPercent" double precision NOT NULL DEFAULT 0,
        "promoCode" varchar NOT NULL DEFAULT '',
        "currency" varchar NOT NULL DEFAULT 'TZS',
        "clicks" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_creator_attribution_links" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_creator_attribution_links_code" ON "creator_attribution_links" ("code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_attribution_links_owner" ON "creator_attribution_links" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_attribution_links_creator" ON "creator_attribution_links" ("creatorId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_attribution_links_campaign" ON "creator_attribution_links" ("campaignId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "creator_attribution_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "linkId" uuid NOT NULL,
        "code" varchar NOT NULL,
        "type" varchar NOT NULL,
        "clickId" varchar NOT NULL DEFAULT '',
        "orderId" uuid,
        "revenue" numeric(18,4) NOT NULL DEFAULT 0,
        "currency" varchar NOT NULL DEFAULT 'TZS',
        "metadata" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_creator_attribution_events" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_attribution_events_link" ON "creator_attribution_events" ("linkId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_attribution_events_order" ON "creator_attribution_events" ("orderId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_attribution_events_click" ON "creator_attribution_events" ("clickId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "creator_commissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "linkId" uuid NOT NULL,
        "campaignId" uuid,
        "creatorId" uuid NOT NULL,
        "ownerId" uuid NOT NULL,
        "orderId" uuid NOT NULL,
        "productId" uuid,
        "baseAmount" numeric(18,4) NOT NULL DEFAULT 0,
        "rate" double precision NOT NULL DEFAULT 0,
        "amount" numeric(18,4) NOT NULL DEFAULT 0,
        "currency" varchar NOT NULL DEFAULT 'TZS',
        "state" varchar NOT NULL DEFAULT 'PENDING',
        "earnedAt" timestamptz,
        CONSTRAINT "PK_creator_commissions" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_creator_commission_order_link" ON "creator_commissions" ("orderId", "linkId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_commissions_creator" ON "creator_commissions" ("creatorId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_commissions_owner" ON "creator_commissions" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_commissions_state" ON "creator_commissions" ("state")`);

    // Creator campaigns get their own table (the legacy marketing `campaigns`
    // table's NOT NULL startDate/endDate meant creator-campaign inserts always
    // failed against a migrated DB). Product-linked promotion columns included.
    await q.query(`
      CREATE TABLE IF NOT EXISTS "creator_campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "brand" varchar NOT NULL DEFAULT '',
        "niche" varchar NOT NULL DEFAULT '',
        "status" varchar NOT NULL DEFAULT 'draft',
        "budgetTzs" numeric(18,2) NOT NULL DEFAULT 0,
        "platformFeePercent" double precision NOT NULL DEFAULT 10,
        "requirements" jsonb NOT NULL DEFAULT '[]',
        "offers" jsonb NOT NULL DEFAULT '[]',
        "endsAt" timestamptz,
        "escrowId" uuid,
        "productId" uuid,
        "productName" varchar NOT NULL DEFAULT '',
        "productPrice" numeric(18,2) NOT NULL DEFAULT 0,
        "commissionPercent" double precision NOT NULL DEFAULT 0,
        "destination" varchar NOT NULL DEFAULT 'jumla',
        "destinationUrl" text NOT NULL DEFAULT '',
        CONSTRAINT "PK_creator_campaigns" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_campaigns_status" ON "creator_campaigns" ("status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IX_creator_campaigns_product" ON "creator_campaigns" ("productId")`);

    // Attribution columns on Jumla merchant orders.
    await q.query(`ALTER TABLE "commerce_merchant_orders" ADD COLUMN IF NOT EXISTS "attributionCode" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "commerce_merchant_orders" ADD COLUMN IF NOT EXISTS "clickId" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "commerce_merchant_orders" ADD COLUMN IF NOT EXISTS "creatorId" uuid`);
    await q.query(`ALTER TABLE "commerce_merchant_orders" ADD COLUMN IF NOT EXISTS "campaignId" uuid`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "commerce_merchant_orders" DROP COLUMN IF EXISTS "attributionCode"`);
    await q.query(`ALTER TABLE "commerce_merchant_orders" DROP COLUMN IF EXISTS "clickId"`);
    await q.query(`ALTER TABLE "commerce_merchant_orders" DROP COLUMN IF EXISTS "creatorId"`);
    await q.query(`ALTER TABLE "commerce_merchant_orders" DROP COLUMN IF EXISTS "campaignId"`);
    await q.query(`DROP TABLE IF EXISTS "creator_campaigns"`);
    await q.query(`DROP TABLE IF EXISTS "creator_commissions"`);
    await q.query(`DROP TABLE IF EXISTS "creator_attribution_events"`);
    await q.query(`DROP TABLE IF EXISTS "creator_attribution_links"`);
  }
}
