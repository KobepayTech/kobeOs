import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Older hotel UI fixtures could persist "connected=true" without an OTA OAuth
 * or synchronization adapter. Clear that false state before production.
 */
export class ResetUnverifiedHotelChannels1785300000000 implements MigrationInterface {
  name = 'ResetUnverifiedHotelChannels1785300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "hotel_channels" SET "connected" = false, "lastSyncAt" = NULL WHERE "connected" = true`);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // Connection state cannot be truthfully reconstructed.
  }
}
