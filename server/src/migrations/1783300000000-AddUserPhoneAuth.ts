import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPhoneAuth1783300000000 implements MigrationInterface {
  name = 'AddUserPhoneAuth1783300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_phone_unique" ON "users" ("phone") WHERE "phone" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_users_phone_unique"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"`);
  }
}
