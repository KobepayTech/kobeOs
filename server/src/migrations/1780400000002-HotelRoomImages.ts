import { MigrationInterface, QueryRunner } from 'typeorm';

export class HotelRoomImages1780400000002 implements MigrationInterface {
  name = 'HotelRoomImages1780400000002';
  public async up(queryRunner: QueryRunner): Promise<void> { await queryRunner.query(`ALTER TABLE "hotel_rooms" ADD "imageUrl" character varying`); }
  public async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query(`ALTER TABLE "hotel_rooms" DROP COLUMN "imageUrl"`); }
}
