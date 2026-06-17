import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a nullable `hotel_id` column to the hotel-scoped tables so an owner
 * running multiple properties can filter rooms / guests / bookings / orders /
 * service requests by property. The column is nullable on purpose — legacy
 * rows created before this migration are left untagged, and the API treats
 * a missing `hotel_id` filter as "across all of this owner's properties"
 * (matches the single-hotel behaviour shipped to date).
 */
export class AddHotelIdScoping1780400000000 implements MigrationInterface {
  name = 'AddHotelIdScoping1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables: Array<{ table: string; index: string }> = [
      { table: 'hotel_rooms',            index: 'idx_hotel_rooms_hotel_id' },
      { table: 'hotel_guests',           index: 'idx_hotel_guests_hotel_id' },
      { table: 'hotel_bookings',         index: 'idx_hotel_bookings_hotel_id' },
      { table: 'hotel_orders',           index: 'idx_hotel_orders_hotel_id' },
      { table: 'hotel_service_requests', index: 'idx_hotel_service_requests_hotel_id' },
    ];

    for (const { table, index } of tables) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "hotelId" uuid`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${index}" ON "${table}" ("hotelId")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables: Array<{ table: string; index: string }> = [
      { table: 'hotel_service_requests', index: 'idx_hotel_service_requests_hotel_id' },
      { table: 'hotel_orders',           index: 'idx_hotel_orders_hotel_id' },
      { table: 'hotel_bookings',         index: 'idx_hotel_bookings_hotel_id' },
      { table: 'hotel_guests',           index: 'idx_hotel_guests_hotel_id' },
      { table: 'hotel_rooms',            index: 'idx_hotel_rooms_hotel_id' },
    ];

    for (const { table, index } of tables) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${index}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "hotelId"`);
    }
  }
}
