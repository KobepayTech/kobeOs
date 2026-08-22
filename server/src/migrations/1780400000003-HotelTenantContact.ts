import { MigrationInterface, QueryRunner } from 'typeorm';

export class HotelTenantContact1780400000003 implements MigrationInterface {
  name = 'HotelTenantContact1780400000003';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "hotel_tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "slug" varchar NOT NULL, "name" varchar NOT NULL, "brandColor" varchar, "logoUrl" varchar, "currency" varchar NOT NULL DEFAULT 'TZS', CONSTRAINT "PK_hotel_tenants" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_tenants_slug" ON "hotel_tenants" ("slug")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IX_hotel_tenants_owner" ON "hotel_tenants" ("ownerId")`);
    await queryRunner.query(`ALTER TABLE "hotel_tenants" ADD COLUMN IF NOT EXISTS "location" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "hotel_tenants" ADD COLUMN IF NOT EXISTS "phone" character varying NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "hotel_tenants" ADD COLUMN IF NOT EXISTS "email" character varying NOT NULL DEFAULT ''`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_tenants" DROP COLUMN IF EXISTS "email"`);
    await queryRunner.query(`ALTER TABLE "hotel_tenants" DROP COLUMN IF EXISTS "phone"`);
    await queryRunner.query(`ALTER TABLE "hotel_tenants" DROP COLUMN IF EXISTS "location"`);
  }
}
