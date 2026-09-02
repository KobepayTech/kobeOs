import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Production cleanup for legacy fixtures that older MVP builds could persist.
 * Deletes only exact known KobeOS demo identifiers; real owner data is untouched.
 */
export class RemoveLegacyProductionFixtures1785600000000 implements MigrationInterface {
  name = 'RemoveLegacyProductionFixtures1785600000000';

  public async up(q: QueryRunner): Promise<void> {
    const vehicleIds = [
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e101',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e102',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e103',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e104',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e105',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e106',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e107',
      '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e108',
    ];

    await q.query(`DELETE FROM "commerce_vehicle_listing_metadata" WHERE "vehicleId" = ANY($1::uuid[])`, [vehicleIds]);
    await q.query(`DELETE FROM "commerce_vehicle_media" WHERE "vehicleId" = ANY($1::uuid[])`, [vehicleIds]);
    await q.query(`DELETE FROM "commerce_vehicle_appointments" WHERE "vehicleId" = ANY($1::uuid[])`, [vehicleIds]);
    await q.query(`DELETE FROM "commerce_vehicle_reservations" WHERE "vehicleId" = ANY($1::uuid[])`, [vehicleIds]);
    await q.query(`DELETE FROM "commerce_vehicle_buyer_requests" WHERE "vehicleId" = ANY($1::uuid[])`, [vehicleIds]);
    await q.query(`DELETE FROM "commerce_vehicles" WHERE "id" = ANY($1::uuid[])`, [vehicleIds]);
    await q.query(`
      DELETE FROM "commerce_businesses"
      WHERE "publicSlug" = 'kijani-motors'
        AND "businessId" = 'BUS-DEMO-KIJANI'
        AND "ownerUserId" = '9f98e9b0-4af9-4f7a-9b92-2ccf78b6e001'
    `);

    await q.query(`
      DELETE FROM "kobepay_payout_receipts"
      WHERE "createdByName" = 'TZ Cashier (demo)'
        AND "supplierNumber" IN ('SUP-CN-001','SUP-CN-002','SUP-CN-003','SUP-CN-004')
        AND "customerReference" LIKE 'CUS-TZ-%'
    `);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // Fabricated production fixtures are intentionally never recreated.
  }
}
