import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Close the column drift between the migrations and the entities.
 *
 * The migrations create every table the entities declare, but were
 * 136 columns behind them. On the migrations-only server path that
 * means the code selects and writes columns the database does not have — a
 * production-only failure that CI could never see, because CI builds its
 * schema from the entities with synchronize. This migration exists so CI can
 * run against migrations instead, which is what would have caught it.
 *
 * Additive only. Nothing is dropped or retyped: a generated schema diff also
 * wants to remove 67 objects, and acting on that would destroy data that
 * earlier migrations deliberately created.
 *
 * 18 columns are declared NOT NULL by their entity but are added
 * nullable here, because NOT NULL without a default cannot be added to a
 * table that already holds rows. The column existing is what the code needs;
 * the entity still requires a value on write.
 */
export class EntityColumnDriftCompletion1786600000000 implements MigrationInterface {
  name = 'EntityColumnDriftCompletion1786600000000';

  public async up(q: QueryRunner): Promise<void> {
    const columns: Array<[string, string, string]> = [
      ['warehouse_items', 'warehouseId', `uuid`],
      ['store_settings', 'jerseyConfig', `jsonb NOT NULL DEFAULT '{}'`],
      ['store_settings', 'siteConfig', `jsonb NOT NULL DEFAULT '{}'`],
      ['store_settings', 'cfTunnelId', `character varying`],
      ['store_settings', 'cfRecordId', `character varying`],
      ['store_settings', 'cfToken', `text`],
      ['sports_matches', 'currentMinute', `integer`],
      ['sports_matches', 'currentHalf', `integer NOT NULL DEFAULT '1'`],
      ['sports_matches', 'trackingActive', `boolean NOT NULL DEFAULT false`],
      ['sports_matches', 'startedAt', `TIMESTAMP WITH TIME ZONE`],
      ['sports_matches', 'endedAt', `TIMESTAMP WITH TIME ZONE`],
      ['properties', 'imageUrl', `character varying NOT NULL DEFAULT ''`],
      ['print_jobs', 'jobNumber', `character varying`],
      ['print_jobs', 'customerPhone', `character varying`],
      ['print_jobs', 'customerEmail', `character varying`],
      ['print_jobs', 'notes', `character varying`],
      ['print_jobs', 'price', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['print_jobs', 'currency', `character varying NOT NULL DEFAULT 'TZS'`],
      ['print_jobs', 'templateId', `character varying`],
      ['print_materials', 'supplier', `character varying`],
      ['print_materials', 'costPerUnit', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['print_materials', 'currency', `character varying NOT NULL DEFAULT 'TZS'`],
      ['pos_products', 'barcode', `character varying`],
      ['pos_products', 'description', `text NOT NULL DEFAULT ''`],
      ['pos_products', 'brand', `character varying`],
      ['pos_products', 'supplier', `character varying`],
      ['pos_products', 'compareAtPrice', `numeric(18,4)`],
      ['pos_products', 'cost', `numeric(18,4)`],
      ['pos_products', 'unit', `character varying NOT NULL DEFAULT 'piece'`],
      ['pos_products', 'decimalQuantity', `boolean NOT NULL DEFAULT false`],
      ['pos_products', 'taxRate', `numeric(6,4) NOT NULL DEFAULT '0'`],
      ['pos_products', 'reservedStock', `integer NOT NULL DEFAULT '0'`],
      ['pos_products', 'estimatedStock', `integer NOT NULL DEFAULT '0'`],
      ['pos_products', 'shelf', `character varying`],
      ['pos_products', 'warehouseId', `character varying`],
      ['pos_products', 'imageUrls', `jsonb NOT NULL DEFAULT '[]'`],
      ['pos_products', 'videoUrl', `character varying`],
      ['pos_products', 'variants', `jsonb NOT NULL DEFAULT '[]'`],
      ['pos_products', 'tags', `jsonb NOT NULL DEFAULT '[]'`],
      ['pos_products', 'featured', `boolean NOT NULL DEFAULT false`],
      ['pos_products', 'publishedAt', `TIMESTAMP WITH TIME ZONE`],
      ['pos_products', 'unitsSold', `integer NOT NULL DEFAULT '0'`],
      ['pos_orders', 'discountCode', `character varying`],
      ['pos_orders', 'fulfillmentStatus', `character varying NOT NULL DEFAULT 'NEW'`],
      ['pos_orders', 'preparingAt', `TIMESTAMP WITH TIME ZONE`],
      ['pos_orders', 'readyAt', `TIMESTAMP WITH TIME ZONE`],
      ['pos_orders', 'collectedAt', `TIMESTAMP WITH TIME ZONE`],
      ['pos_orders', 'bnplApproved', `boolean NOT NULL DEFAULT false`],
      ['pos_orders', 'bnplPlan', `character varying`],
      ['pos_orders', 'isBnpl', `boolean NOT NULL DEFAULT false`],
      ['pos_orders', 'receivableId', `uuid`],
      ['pos_order_items', 'unit', `character varying NOT NULL DEFAULT 'piece'`],
      ['pos_order_items', 'shelf', `character varying`],
      ['hotel_bookings', 'palmPesaOrderId', `character varying`],
      ['hotel_chains', 'createdAt', `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`],
      ['hotel_chains', 'updatedAt', `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`],
      ['hotel_chains', 'ownerId', `uuid`],
      ['hotel_chains', 'brandColor', `character varying DEFAULT '#7B8CDE'`],
      ['hotel_chains', 'isActive', `boolean NOT NULL DEFAULT true`],
      ['hotel_parking_spots', 'createdAt', `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`],
      ['hotel_parking_spots', 'updatedAt', `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`],
      ['hotel_parking_spots', 'ownerId', `uuid`],
      ['hotel_parking_spots', 'hotelId', `uuid`],
      ['hotel_parking_spots', 'spotNumber', `character varying`],
      ['hotel_parking_spots', 'vehiclePlate', `character varying`],
      ['hotel_parking_spots', 'vehicleModel', `character varying`],
      ['hotel_parking_spots', 'guestId', `uuid`],
      ['hotel_parking_spots', 'reservedUntil', `TIMESTAMP WITH TIME ZONE`],
      ['hotel_parking_spots', 'ratePerDay', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['hotel_financials', 'createdAt', `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`],
      ['hotel_financials', 'updatedAt', `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`],
      ['hotel_financials', 'ownerId', `uuid`],
      ['hotel_financials', 'hotelId', `uuid`],
      ['hotel_financials', 'recordDate', `date`],
      ['erp_suppliers', 'currency', `character varying NOT NULL DEFAULT 'CNY'`],
      ['erp_suppliers', 'cnyAccount', `character varying NOT NULL DEFAULT ''`],
      ['erp_suppliers', 'contactPerson', `character varying NOT NULL DEFAULT ''`],
      ['erp_suppliers', 'notes', `text NOT NULL DEFAULT ''`],
      ['erp_purchase_orders', 'supplierId', `uuid`],
      ['erp_purchase_orders', 'totalCny', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['erp_purchase_orders', 'paidCny', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['erp_purchase_orders', 'remainingCny', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['erp_purchase_orders', 'expectedDate', `date`],
      ['erp_purchase_orders', 'notes', `text NOT NULL DEFAULT ''`],
      ['erp_purchase_orders', 'transportCost', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['erp_purchase_orders', 'inventoryStatus', `character varying NOT NULL DEFAULT 'PENDING'`],
      ['erp_purchase_orders', 'receivedAt', `TIMESTAMP WITH TIME ZONE`],
      ['erp_suppliers', 'contact', `character varying NOT NULL DEFAULT ''`],
      ['erp_suppliers', 'rating', `double precision NOT NULL DEFAULT '0'`],
      ['erp_suppliers', 'status', `character varying NOT NULL DEFAULT 'Active'`],
      ['erp_purchase_orders', 'supplier', `character varying NOT NULL DEFAULT ''`],
      ['erp_purchase_orders', 'total', `double precision NOT NULL DEFAULT '0'`],
      ['erp_purchase_orders', 'paidAmount', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['erp_purchase_orders', 'date', `character varying`],
      ['erp_purchase_orders', 'deliveryDate', `character varying`],
      ['creators', 'country', `character varying NOT NULL DEFAULT ''`],
      ['creators', 'avgViews', `double precision NOT NULL DEFAULT '0'`],
      ['creators', 'phone', `character varying`],
      ['creators', 'bio', `character varying`],
      ['creators', 'platformStats', `jsonb NOT NULL DEFAULT '[]'`],
      ['creators', 'fraudSignals', `jsonb`],
      ['creators', 'weeklyRateTzs', `numeric(18,2) NOT NULL DEFAULT '0'`],
      ['creators', 'subscriptionTier', `character varying NOT NULL DEFAULT 'free'`],
      ['creators', 'lastSyncedAt', `TIMESTAMP WITH TIME ZONE`],
      ['parcels', 'customerId', `uuid`],
      ['parcels', 'boxId', `uuid`],
      ['parcels', 'lifecycleStatus', `character varying NOT NULL DEFAULT 'AWAITING_STORAGE'`],
      ['parcels', 'preAlertedAt', `TIMESTAMP WITH TIME ZONE`],
      ['parcels', 'externalTracking', `character varying`],
      ['warehouse_items', 'unitCost', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['video_jobs', 'completedAt', `TIMESTAMP WITH TIME ZONE`],
      ['social_posts', 'status', `"public"."social_posts_status_enum" NOT NULL DEFAULT 'draft'`],
      ['property_units', 'rentAmount', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['rent_payments', 'amount', `numeric(18,4)`],
      ['print_jobs', 'dueDate', `date`],
      ['print_materials', 'stock', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['print_materials', 'minThreshold', `numeric(18,4) NOT NULL DEFAULT '0'`],
      ['pos_order_items', 'quantity', `numeric(18,4) NOT NULL DEFAULT '1'`],
      ['kp_schools', 'code', `character varying(24)`],
      ['kp_students', 'studentCode', `character varying(32)`],
      ['kp_merchants', 'merchantCode', `character varying(32)`],
      ['kp_suppliers', 'code', `character varying(32)`],
      ['hotel_chains', 'slug', `character varying`],
      ['hotel_chains', 'name', `character varying`],
      ['hotel_chains', 'description', `character varying`],
      ['hotel_chains', 'currency', `character varying NOT NULL DEFAULT 'TZS'`],
      ['hotel_parking_spots', 'type', `character varying NOT NULL DEFAULT 'car'`],
      ['hotel_parking_spots', 'status', `character varying NOT NULL DEFAULT 'free'`],
      ['hotel_financials', 'category', `character varying`],
      ['hotel_financials', 'currency', `character varying NOT NULL DEFAULT 'TZS'`],
      ['hotel_financials', 'description', `character varying NOT NULL DEFAULT ''`],
      ['hotel_financials', 'granularity', `character varying NOT NULL DEFAULT 'daily'`],
      ['hotel_procurement_requests', 'reviewedBy', `uuid`],
      ['discount_rules', 'value', `numeric(18,4)`],
      ['coupons', 'value', `numeric(18,4)`],
      ['campaigns', 'budget', `numeric(18,4) NOT NULL DEFAULT '0'`],
    ];

    for (const [table, column, spec] of columns) {
      // Skipped rather than failed when the table is absent, so this cannot
      // break a database built by a different subset of migrations.
      const exists = await q.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [table],
      );
      if (!exists.length) continue;
      await q.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${spec}`);
    }
  }

  public async down(): Promise<void> {
    // Deliberately irreversible: dropping these would remove columns the
    // running code reads, and several are already populated by then.
  }
}
