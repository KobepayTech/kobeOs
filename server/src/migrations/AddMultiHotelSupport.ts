import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiHotelSupport implements MigrationInterface {
  name = 'AddMultiHotelSupport';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── hotel_chains ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hotel_chains (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id    uuid NOT NULL,
        slug        varchar(255) NOT NULL UNIQUE,
        name        varchar(255) NOT NULL,
        description text,
        currency    varchar(8) NOT NULL DEFAULT 'TZS',
        brand_color varchar(8) DEFAULT '#7B8CDE',
        is_active   boolean NOT NULL DEFAULT true,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_hotel_chains_owner_id ON hotel_chains(owner_id);
    `);

    // ── hotel_parking_spots ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hotel_parking_spots (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id       uuid NOT NULL,
        hotel_id       uuid NOT NULL,
        spot_number    varchar(40) NOT NULL,
        type           varchar(20) NOT NULL DEFAULT 'car',
        status         varchar(20) NOT NULL DEFAULT 'free',
        vehicle_plate  varchar(40),
        vehicle_model  varchar(120),
        guest_id       uuid,
        reserved_until timestamptz,
        rate_per_day   decimal(18,4) NOT NULL DEFAULT 0,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_parking_hotel_id ON hotel_parking_spots(hotel_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_parking_status ON hotel_parking_spots(status);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_parking_owner_id ON hotel_parking_spots(owner_id);
    `);

    // ── hotel_financials ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS hotel_financials (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id    uuid NOT NULL,
        hotel_id    uuid NOT NULL,
        category    varchar(40) NOT NULL,
        amount      decimal(18,4) NOT NULL DEFAULT 0,
        currency    varchar(8) NOT NULL DEFAULT 'TZS',
        record_date date NOT NULL,
        description text NOT NULL DEFAULT '',
        granularity varchar(20) NOT NULL DEFAULT 'daily',
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_financials_hotel_date ON hotel_financials(hotel_id, record_date);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_financials_owner_id ON hotel_financials(owner_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_financials_owner_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_financials_hotel_date;`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_financials;`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_parking_owner_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_parking_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_parking_hotel_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_parking_spots;`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_hotel_chains_owner_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_chains;`);
  }
}
