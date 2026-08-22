import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds separately billed mobile-module entitlements. The base mobile workspace
 * subscription remains unchanged; add-ons use independent 30-day expiries in
 * the JSON map so buying Hotel cannot accidentally make every module visible.
 */
export class AddMobileModuleEntitlements1781100000000 implements MigrationInterface {
  name = 'AddMobileModuleEntitlements1781100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "mobile_subscriptions" ADD COLUMN IF NOT EXISTS "moduleEntitlements" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await q.query(
      `ALTER TABLE "mobile_subscriptions" ADD COLUMN IF NOT EXISTS "pendingModuleId" character varying`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "mobile_subscriptions" DROP COLUMN IF EXISTS "pendingModuleId"`);
    await q.query(`ALTER TABLE "mobile_subscriptions" DROP COLUMN IF EXISTS "moduleEntitlements"`);
  }
}
