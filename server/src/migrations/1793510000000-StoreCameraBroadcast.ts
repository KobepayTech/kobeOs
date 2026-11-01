import { MigrationInterface, QueryRunner } from 'typeorm';

export class StoreCameraBroadcast1793510000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "live_broadcast_settings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "ownerId" uuid NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "publishUrl" text NOT NULL, "playbackUrl" text NOT NULL
    )`);
    await queryRunner.query('ALTER TABLE "live_sessions" ADD COLUMN IF NOT EXISTS "broadcastPlaybackUrl" text');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "live_sessions" DROP COLUMN IF EXISTS "broadcastPlaybackUrl"');
    await queryRunner.query('DROP TABLE IF EXISTS "live_broadcast_settings"');
  }
}
