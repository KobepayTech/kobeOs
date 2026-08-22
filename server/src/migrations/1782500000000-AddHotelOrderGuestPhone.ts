import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHotelOrderGuestPhone1782500000000 implements MigrationInterface {
  name = 'AddHotelOrderGuestPhone1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_orders"
      ADD COLUMN IF NOT EXISTS "guestPhone" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_orders"
      DROP COLUMN IF EXISTS "guestPhone"
    `);
  }
}
