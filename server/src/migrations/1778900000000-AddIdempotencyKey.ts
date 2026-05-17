import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdempotencyKey1778900000000 implements MigrationInterface {
  name = 'AddIdempotencyKey1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_transactions') THEN
          ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "idempotencyKey" character varying;
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_transactions_idempotencyKey"
            ON "payment_transactions" ("idempotencyKey")
            WHERE "idempotencyKey" IS NOT NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_payment_transactions_idempotencyKey"`);
    await queryRunner.query(`ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "idempotencyKey"`);
  }
}
