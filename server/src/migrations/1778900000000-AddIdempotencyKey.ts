import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdempotencyKey1778900000000 implements MigrationInterface {
  name = 'AddIdempotencyKey1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      ADD COLUMN IF NOT EXISTS "idempotencyKey" character varying
    `);

    // Partial unique index: only enforce uniqueness when the key is present.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_transactions_idempotencyKey"
      ON "payment_transactions" ("idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_payment_transactions_idempotencyKey"
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_transactions"
      DROP COLUMN IF EXISTS "idempotencyKey"
    `);
  }
}
