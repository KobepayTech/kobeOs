import { MigrationInterface, QueryRunner } from 'typeorm';

export class HotelMenuImages1780400000001 implements MigrationInterface {
  name = 'HotelMenuImages1780400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_menu_items" ADD "imageUrl" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_menu_items" DROP COLUMN "imageUrl"`);
  }
}
