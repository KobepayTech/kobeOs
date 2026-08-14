import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shared mobile-money / bank SMS bridge: forwarder device registry + a deduped
 * inbound-payment inbox any module can consume.
 */
export class AddMobileMoney1782600000000 implements MigrationInterface {
  name = 'AddMobileMoney1782600000000';

  public async up(q: QueryRunner): Promise<void> {
    const owned = `
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL`;

    await q.query(`CREATE TABLE IF NOT EXISTS "mm_sms_devices" (${owned},
      "deviceId" character varying NOT NULL,
      "label" character varying NOT NULL DEFAULT '',
      "gatewayKeyHash" character varying NOT NULL,
      "purpose" character varying NOT NULL DEFAULT 'general',
      "active" boolean NOT NULL DEFAULT true,
      "lastSeenAt" timestamptz,
      CONSTRAINT "PK_mm_sms_devices" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_mm_device_id" UNIQUE ("deviceId"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_mm_devices_owner" ON "mm_sms_devices" ("ownerId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "mm_inbound_payments" (${owned},
      "deviceId" character varying NOT NULL DEFAULT '',
      "transactionId" character varying NOT NULL,
      "provider" character varying NOT NULL DEFAULT 'UNKNOWN',
      "direction" character varying NOT NULL DEFAULT 'UNKNOWN',
      "amount" numeric(18,4) NOT NULL DEFAULT 0,
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "senderName" character varying NOT NULL DEFAULT '',
      "senderPhone" character varying NOT NULL DEFAULT '',
      "reference" character varying NOT NULL DEFAULT '',
      "account" character varying NOT NULL DEFAULT '',
      "status" character varying NOT NULL DEFAULT 'RECEIVED',
      "consumedBy" character varying NOT NULL DEFAULT '',
      "consumedRef" character varying NOT NULL DEFAULT '',
      "rawMessage" text NOT NULL DEFAULT '',
      CONSTRAINT "PK_mm_inbound_payments" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_mm_inbound_txn" UNIQUE ("ownerId","transactionId"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_mm_inbound_owner" ON "mm_inbound_payments" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_mm_inbound_owner_status_created" ON "mm_inbound_payments" ("ownerId","status","createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "mm_inbound_payments"`);
    await q.query(`DROP TABLE IF EXISTS "mm_sms_devices"`);
  }
}
