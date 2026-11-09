import { MigrationInterface, QueryRunner } from 'typeorm';

export class SocialCommentSales1794173000000 implements MigrationInterface {
  name = 'SocialCommentSales1794173000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "live_comments" ADD COLUMN IF NOT EXISTS "publicReplyText" text NOT NULL DEFAULT \'\'');
    await queryRunner.query('ALTER TABLE "pos_orders" ADD COLUMN IF NOT EXISTS "fulfillmentMethod" varchar(8), ADD COLUMN IF NOT EXISTS "fulfillmentLocation" varchar(500)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "pos_orders" DROP COLUMN IF EXISTS "fulfillmentLocation", DROP COLUMN IF EXISTS "fulfillmentMethod"');
    await queryRunner.query('ALTER TABLE "live_comments" DROP COLUMN IF EXISTS "publicReplyText"');
  }
}
