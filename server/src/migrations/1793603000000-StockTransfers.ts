import { MigrationInterface, QueryRunner } from 'typeorm';
export class StockTransfers1793603000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "warehouse_stock_transfers" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "requestKey" varchar(100) NOT NULL,
      "fromItemId" uuid NOT NULL, "toItemId" uuid NOT NULL, "quantity" integer NOT NULL CHECK ("quantity" > 0),
      CONSTRAINT "UQ_stock_transfer_source" UNIQUE ("ownerId", "requestKey"))`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE IF EXISTS "warehouse_stock_transfers"'); }
}
