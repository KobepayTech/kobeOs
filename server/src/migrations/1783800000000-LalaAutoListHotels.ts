import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every hotel now appears on the public Lala network by default; the only thing
 * that hides one is an explicit owner opt-out. Adds the `hiddenFromLala` flag
 * to Lala hotel profiles (default false = visible).
 */
export class LalaAutoListHotels1783800000000 implements MigrationInterface {
  name = 'LalaAutoListHotels1783800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "lala_hotel_profiles" ADD COLUMN IF NOT EXISTS "hiddenFromLala" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "lala_hotel_profiles" DROP COLUMN IF EXISTS "hiddenFromLala"`);
  }
}
