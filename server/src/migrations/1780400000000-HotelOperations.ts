import { MigrationInterface, QueryRunner } from 'typeorm';

export class HotelOperations1780400000000 implements MigrationInterface {
  name = 'HotelOperations1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "hotel_procurement_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "department" character varying NOT NULL, "lines" jsonb NOT NULL DEFAULT '[]', "status" character varying NOT NULL DEFAULT 'PENDING', "currency" character varying NOT NULL DEFAULT 'TZS', "note" character varying NOT NULL DEFAULT '', "hotelId" uuid, "reviewedBy" character varying, "purchasedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_hotel_procurement_requests" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_hotel_procurement_requests_owner_status" ON "hotel_procurement_requests" ("ownerId", "status")`);
    await queryRunner.query(`CREATE TABLE "hotel_payroll_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "employeeName" character varying NOT NULL, "staffId" uuid, "period" character varying NOT NULL, "baseSalary" numeric(18,2) NOT NULL DEFAULT 0, "overtime" numeric(18,2) NOT NULL DEFAULT 0, "allowances" numeric(18,2) NOT NULL DEFAULT 0, "deductions" numeric(18,2) NOT NULL DEFAULT 0, "netPay" numeric(18,2) NOT NULL DEFAULT 0, "status" character varying NOT NULL DEFAULT 'POSTED', "currency" character varying NOT NULL DEFAULT 'TZS', "hotelId" uuid, "paidAt" TIMESTAMP WITH TIME ZONE, "note" character varying NOT NULL DEFAULT '', CONSTRAINT "PK_hotel_payroll_records" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_hotel_payroll_records_owner_period" ON "hotel_payroll_records" ("ownerId", "period")`);
    await queryRunner.query(`CREATE TABLE "hotel_petty_cash_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "kind" character varying NOT NULL DEFAULT 'expense', "category" character varying NOT NULL DEFAULT 'general', "amount" numeric(18,2) NOT NULL DEFAULT 0, "description" character varying NOT NULL, "paidTo" character varying NOT NULL DEFAULT '', "reference" character varying NOT NULL DEFAULT '', "entryDate" date NOT NULL, "currency" character varying NOT NULL DEFAULT 'TZS', "hotelId" uuid, CONSTRAINT "PK_hotel_petty_cash_entries" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_hotel_petty_cash_entries_owner_date" ON "hotel_petty_cash_entries" ("ownerId", "entryDate")`);
    await queryRunner.query(`CREATE TABLE "hotel_assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "assetCode" character varying NOT NULL, "name" character varying NOT NULL, "category" character varying NOT NULL DEFAULT 'hotel equipment', "acquisitionDate" date NOT NULL, "acquisitionCost" numeric(18,2) NOT NULL DEFAULT 0, "residualValue" numeric(18,2) NOT NULL DEFAULT 0, "usefulLifeMonths" integer NOT NULL DEFAULT 60, "depreciationMethod" character varying NOT NULL DEFAULT 'straight_line', "status" character varying NOT NULL DEFAULT 'active', "currency" character varying NOT NULL DEFAULT 'TZS', "hotelId" uuid, "note" character varying NOT NULL DEFAULT '', CONSTRAINT "PK_hotel_assets" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_hotel_assets_owner_code" ON "hotel_assets" ("ownerId", "assetCode")`);
    await queryRunner.query(`CREATE TABLE "hotel_ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "entryDate" date NOT NULL, "account" character varying NOT NULL, "department" character varying NOT NULL DEFAULT 'general', "side" character varying NOT NULL DEFAULT 'debit', "amount" numeric(18,2) NOT NULL DEFAULT 0, "currency" character varying NOT NULL DEFAULT 'TZS', "description" character varying NOT NULL DEFAULT '', "sourceType" character varying NOT NULL DEFAULT 'manual', "sourceId" uuid, "hotelId" uuid, CONSTRAINT "PK_hotel_ledger_entries" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_hotel_ledger_entries_owner_date" ON "hotel_ledger_entries" ("ownerId", "entryDate")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_hotel_ledger_entries_owner_date"`);
    await queryRunner.query(`DROP TABLE "hotel_ledger_entries"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hotel_assets_owner_code"`);
    await queryRunner.query(`DROP TABLE "hotel_assets"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hotel_petty_cash_entries_owner_date"`);
    await queryRunner.query(`DROP TABLE "hotel_petty_cash_entries"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hotel_payroll_records_owner_period"`);
    await queryRunner.query(`DROP TABLE "hotel_payroll_records"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hotel_procurement_requests_owner_status"`);
    await queryRunner.query(`DROP TABLE "hotel_procurement_requests"`);
  }
}
