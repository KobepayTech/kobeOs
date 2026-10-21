import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reconcile the payment_transactions idempotency index with the entity.
 *
 * AddIdempotencyKey1778900000000 created a GLOBAL unique index on
 * idempotencyKey alone. The entity declares a composite unique index on
 * (ownerId, idempotencyKey). Only migrated databases — i.e. production — got
 * the global one, so a transfer writing two legs under one key failed there
 * and nowhere else: desktop and CI build their schema from the entities.
 *
 * The composite index is the correct constraint. An idempotency key is
 * supplied by a client and only ever has to be unique within the account that
 * sent it; making it globally unique also let one owner's key collide with
 * another's, which is a cross-tenant failure in its own right.
 */
export class FixPaymentIdempotencyIndex1786500000000 implements MigrationInterface {
  name = 'FixPaymentIdempotencyIndex1786500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_transactions') THEN
          -- Create the correct index first so the table is never left without
          -- idempotency protection, even briefly.
          CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_owner_idempotency_uk"
            ON "payment_transactions" ("ownerId", "idempotencyKey")
            WHERE "idempotencyKey" IS NOT NULL;
          DROP INDEX IF EXISTS "UQ_payment_transactions_idempotencyKey";
        END IF;
      END $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Deliberately does NOT restore the global index: re-creating it would
    // fail on any database that has since recorded two transfer legs, and it
    // was wrong in the first place.
    await q.query(`DROP INDEX IF EXISTS "payment_transactions_owner_idempotency_uk"`);
  }
}
