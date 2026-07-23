import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertyPaymentOrders1781400000000 implements MigrationInterface {
  name = 'AddPropertyPaymentOrders1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "property_collection_partners" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "name" varchar(120) NOT NULL,
      "type" varchar(20) NOT NULL,
      "partnerCode" varchar(30) NOT NULL,
      "pinHash" varchar(256) NOT NULL,
      "commissionPct" decimal(8,4) NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'ACTIVE',
      "phone" varchar NOT NULL DEFAULT '',
      "branch" varchar NOT NULL DEFAULT '',
      "lastLoginAt" timestamptz
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_property_collection_partner_code" ON "property_collection_partners" ("ownerId", "partnerCode")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "property_payment_orders" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "code" varchar(16) NOT NULL,
      "publicToken" varchar(64) NOT NULL,
      "tenantId" uuid NOT NULL,
      "unitId" uuid NOT NULL,
      "chargeId" uuid,
      "invoiceReference" varchar NOT NULL DEFAULT '',
      "expectedAmount" decimal(18,4) NOT NULL,
      "paidAmount" decimal(18,4) NOT NULL DEFAULT 0,
      "currency" varchar NOT NULL DEFAULT 'TZS',
      "allowedVariance" decimal(18,4) NOT NULL DEFAULT 0,
      "partialAllowed" boolean NOT NULL DEFAULT false,
      "allowedChannels" text NOT NULL DEFAULT '[]',
      "assignedPartnerId" uuid,
      "status" varchar NOT NULL DEFAULT 'ACTIVE',
      "expiresAt" timestamptz NOT NULL,
      "paidAt" timestamptz,
      "cancelledAt" timestamptz,
      "cancellationReason" varchar NOT NULL DEFAULT ''
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_property_payment_order_code" ON "property_payment_orders" ("code")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_property_payment_order_public_token" ON "property_payment_orders" ("publicToken")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_property_payment_order_owner_status" ON "property_payment_orders" ("ownerId", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_property_payment_order_owner_tenant" ON "property_payment_orders" ("ownerId", "tenantId")`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "property_payment_redemptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "orderId" uuid NOT NULL,
      "partnerId" uuid NOT NULL,
      "idempotencyKey" varchar(120) NOT NULL,
      "amount" decimal(18,4) NOT NULL,
      "currency" varchar NOT NULL DEFAULT 'TZS',
      "channel" varchar(30) NOT NULL,
      "reference" varchar NOT NULL DEFAULT '',
      "commissionAmount" decimal(18,4) NOT NULL DEFAULT 0,
      "status" varchar NOT NULL DEFAULT 'CONFIRMED',
      "receivedAt" timestamptz NOT NULL,
      "reversedAt" timestamptz,
      "reversalReason" varchar NOT NULL DEFAULT ''
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_property_payment_redemption_idempotency" ON "property_payment_redemptions" ("ownerId", "idempotencyKey")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_property_payment_redemption_order" ON "property_payment_redemptions" ("ownerId", "orderId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_property_payment_redemption_partner" ON "property_payment_redemptions" ("ownerId", "partnerId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "property_payment_redemptions"');
    await queryRunner.query('DROP TABLE IF EXISTS "property_payment_orders"');
    await queryRunner.query('DROP TABLE IF EXISTS "property_collection_partners"');
  }
}
