import { MigrationInterface, QueryRunner } from 'typeorm';
export class PhoneLiveComments1785800000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "sourceHandle" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "relayTargetUrl" text`);
    await q.query(`ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "relayExpiresAt" timestamptz`);
  }
  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE "live_sessions" DROP COLUMN IF EXISTS "relayExpiresAt", DROP COLUMN IF EXISTS "relayTargetUrl", DROP COLUMN IF EXISTS "sourceHandle"`);
  }
}
