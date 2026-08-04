import { MigrationInterface, QueryRunner } from 'typeorm';

export class HotelTenantContact1780400000003 implements MigrationInterface {
  name = 'HotelTenantContact1780400000003';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_tenants" ADD "location" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "hotel_tenants" ADD "phone" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "hotel_tenants" ADD "email" character varying NOT NULL DEFAULT ''`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_tenants" DROP COLUMN "email"`);
    await queryRunner.query(`ALTER TABLE "hotel_tenants" DROP COLUMN "phone"`);
    await queryRunner.query(`ALTER TABLE "hotel_tenants" DROP COLUMN "location"`);
  }
}
