import { MigrationInterface, QueryRunner } from 'typeorm';

const base = `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()`;
const owned = `${base}, "ownerId" uuid NOT NULL`;
const jsonObject = `'{}'::jsonb`;
const jsonArray = `'[]'::jsonb`;

export class MasterEcosystemAllItems1783500000000 implements MigrationInterface {
  name = 'MasterEcosystemAllItems1783500000000';

  public async up(q: QueryRunner): Promise<void> {
    const tables: Array<[string, string]> = [
      ['platform_domain_events', `${base}, "ownerId" uuid, "eventName" varchar NOT NULL, "aggregateType" varchar NOT NULL, "aggregateId" uuid, "payload" jsonb NOT NULL DEFAULT ${jsonObject}, "occurredAt" timestamptz NOT NULL, "status" varchar NOT NULL DEFAULT 'RECORDED', "attempts" integer NOT NULL DEFAULT 0, "publishedAt" timestamptz`],
      ['platform_notifications', `${base}, "ownerId" uuid, "recipientKey" varchar NOT NULL DEFAULT '', "phone" varchar NOT NULL DEFAULT '', "email" varchar NOT NULL DEFAULT '', "title" varchar NOT NULL, "body" text NOT NULL, "actionUrl" varchar NOT NULL DEFAULT '', "requestedChannels" jsonb NOT NULL DEFAULT ${jsonArray}, "delivery" jsonb NOT NULL DEFAULT ${jsonObject}, "readAt" timestamptz`],

      ['commerce_businesses', `${base}, "businessId" varchar NOT NULL, "publicSlug" varchar NOT NULL, "ownerUserId" uuid, "catalogOwnerId" uuid NOT NULL, "name" varchar NOT NULL, "merchantName" varchar NOT NULL DEFAULT '', "phone" varchar NOT NULL DEFAULT '', "email" varchar NOT NULL DEFAULT '', "tier" varchar NOT NULL DEFAULT 'LITE', "status" varchar NOT NULL DEFAULT 'ACTIVE', "websiteEnabled" boolean NOT NULL DEFAULT false, "managementTokenHash" varchar NOT NULL DEFAULT '', "profile" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['commerce_business_locations', `${base}, "businessId" uuid NOT NULL, "propertyId" uuid, "shopUnitId" uuid, "name" varchar NOT NULL, "address" varchar NOT NULL DEFAULT '', "latitude" varchar NOT NULL DEFAULT '', "longitude" varchar NOT NULL DEFAULT '', "active" boolean NOT NULL DEFAULT true`],
      ['commerce_property_floors', `${owned}, "propertyId" uuid NOT NULL, "name" varchar NOT NULL, "code" varchar NOT NULL, "level" integer NOT NULL DEFAULT 0, "shopCount" integer NOT NULL DEFAULT 0`],
      ['commerce_shop_units', `${owned}, "propertyId" uuid NOT NULL, "floorId" uuid NOT NULL, "unitNumber" varchar NOT NULL, "publicCode" varchar NOT NULL, "categoryId" varchar NOT NULL DEFAULT '', "status" varchar NOT NULL DEFAULT 'AVAILABLE', "businessId" uuid`],
      ['commerce_merchant_claims', `${base}, "propertyId" uuid NOT NULL, "shopUnitId" uuid NOT NULL, "businessId" uuid NOT NULL, "claimantName" varchar NOT NULL, "claimantPhone" varchar NOT NULL, "categoryId" varchar NOT NULL DEFAULT '', "status" varchar NOT NULL DEFAULT 'APPROVED', "decidedAt" timestamptz`],
      ['commerce_categories', `${base}, "name" varchar NOT NULL, "slug" varchar NOT NULL, "parentId" uuid, "icon" varchar NOT NULL DEFAULT '', "active" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT 0`],
      ['commerce_product_media', `${base}, "productId" uuid NOT NULL, "url" varchar NOT NULL, "kind" varchar NOT NULL DEFAULT 'IMAGE', "sortOrder" integer NOT NULL DEFAULT 0, "crop" jsonb NOT NULL DEFAULT ${jsonObject}, "publicToken" varchar, "mimeType" varchar, "contentBinary" bytea`],
      ['commerce_nodes', `${base}, "businessId" uuid NOT NULL, "nodeName" varchar NOT NULL, "nodeKeyHash" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'OFFLINE', "lastSeenAt" timestamptz, "version" varchar NOT NULL DEFAULT '', "endpoint" varchar NOT NULL DEFAULT '', "catalogueVersion" varchar NOT NULL DEFAULT ''`],
      ['commerce_node_heartbeats', `${base}, "nodeId" uuid NOT NULL, "businessId" uuid NOT NULL, "receivedAt" timestamptz NOT NULL, "state" varchar NOT NULL DEFAULT 'ONLINE', "metadata" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['commerce_product_snippets', `${base}, "businessId" uuid NOT NULL, "productId" uuid NOT NULL, "catalogOwnerId" uuid NOT NULL, "nodeId" uuid, "name" varchar NOT NULL, "description" varchar NOT NULL DEFAULT '', "category" varchar NOT NULL DEFAULT '', "price" decimal(18,4) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS', "imageUrl" varchar NOT NULL DEFAULT '', "stock" integer NOT NULL DEFAULT 0, "active" boolean NOT NULL DEFAULT true, "indexedAt" timestamptz NOT NULL, "merchantWebsite" varchar NOT NULL DEFAULT '', "locationLabel" varchar NOT NULL DEFAULT '', "lastOnlineAt" timestamptz, "availabilityHint" varchar NOT NULL DEFAULT ''`],
      ['commerce_customers', `${base}, "phone" varchar NOT NULL, "name" varchar NOT NULL DEFAULT '', "email" varchar NOT NULL DEFAULT '', "defaultAddress" varchar NOT NULL DEFAULT '', "preferences" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['commerce_carts', `${base}, "customerId" uuid NOT NULL, "status" varchar NOT NULL DEFAULT 'OPEN', "currency" varchar NOT NULL DEFAULT 'TZS'`],
      ['commerce_cart_lines', `${base}, "cartId" uuid NOT NULL, "businessId" uuid NOT NULL, "productId" uuid NOT NULL, "quantity" decimal(18,4) NOT NULL, "selectedOptions" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['commerce_merchant_orders', `${base}, "orderNumber" varchar NOT NULL, "businessId" uuid NOT NULL, "customerId" uuid NOT NULL, "cartId" uuid NOT NULL, "status" varchar NOT NULL DEFAULT 'SUBMITTED', "fulfillment" varchar NOT NULL DEFAULT 'PICKUP', "deliveryAddress" varchar NOT NULL DEFAULT '', "customerNote" varchar NOT NULL DEFAULT '', "total" decimal(18,4) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS', "merchantLocked" boolean NOT NULL DEFAULT false, "channel" varchar NOT NULL DEFAULT 'jumla'`],
      ['commerce_order_lines', `${base}, "merchantOrderId" uuid NOT NULL, "productId" uuid NOT NULL, "productName" varchar NOT NULL, "unitPrice" decimal(18,4) NOT NULL, "quantity" decimal(18,4) NOT NULL, "lineTotal" decimal(18,4) NOT NULL, "selectedOptions" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['commerce_merchant_quotas', `${base}, "businessId" uuid NOT NULL, "freeOrderLimit" integer NOT NULL DEFAULT 50, "submittedOrders" integer NOT NULL DEFAULT 0, "lockedOrders" integer NOT NULL DEFAULT 0, "activatedAt" timestamptz`],
      ['commerce_interest_events', `${base}, "productId" uuid NOT NULL, "businessId" uuid NOT NULL, "customerId" uuid, "eventType" varchar NOT NULL, "sessionId" varchar NOT NULL DEFAULT '', "metadata" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['commerce_vehicles', `${base}, "businessId" uuid NOT NULL, "catalogOwnerId" uuid NOT NULL, "stockNumber" varchar NOT NULL, "make" varchar NOT NULL, "model" varchar NOT NULL, "year" integer NOT NULL, "trim" varchar NOT NULL DEFAULT '', "price" decimal(18,2) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS', "mileage" integer NOT NULL DEFAULT 0, "transmission" varchar NOT NULL DEFAULT '', "fuel" varchar NOT NULL DEFAULT '', "color" varchar NOT NULL DEFAULT '', "interiorColor" varchar NOT NULL DEFAULT '', "engine" varchar NOT NULL DEFAULT '', "driveType" varchar NOT NULL DEFAULT '', "bodyType" varchar NOT NULL DEFAULT '', "vin" varchar NOT NULL DEFAULT '', "registration" varchar NOT NULL DEFAULT '', "dutyStatus" varchar NOT NULL DEFAULT '', "source" varchar NOT NULL DEFAULT 'LOCAL', "financingAvailable" boolean NOT NULL DEFAULT false, "negotiable" boolean NOT NULL DEFAULT false, "features" jsonb NOT NULL DEFAULT ${jsonArray}, "location" varchar NOT NULL DEFAULT '', "condition" varchar NOT NULL DEFAULT 'USED', "status" varchar NOT NULL DEFAULT 'AVAILABLE', "description" text NOT NULL DEFAULT '', "aiSalesCopy" text NOT NULL DEFAULT '', "metadata" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['commerce_vehicle_media', `${base}, "vehicleId" uuid NOT NULL, "url" varchar NOT NULL, "kind" varchar NOT NULL DEFAULT 'IMAGE', "sortOrder" integer NOT NULL DEFAULT 0`],
      ['commerce_vehicle_listing_metadata', `${base}, "vehicleId" uuid NOT NULL, "highlights" jsonb NOT NULL DEFAULT ${jsonArray}, "keywords" jsonb NOT NULL DEFAULT ${jsonArray}, "socialCaption" varchar NOT NULL DEFAULT '', "verticalVideoUrl" varchar NOT NULL DEFAULT '', "purchaseCost" decimal(18,2) NOT NULL DEFAULT 0, "dutyCost" decimal(18,2) NOT NULL DEFAULT 0, "clearingCost" decimal(18,2) NOT NULL DEFAULT 0, "transportCost" decimal(18,2) NOT NULL DEFAULT 0, "repairCost" decimal(18,2) NOT NULL DEFAULT 0, "advertisingCost" decimal(18,2) NOT NULL DEFAULT 0`],
      ['commerce_vehicle_buyer_requests', `${base}, "vehicleId" uuid NOT NULL, "businessId" uuid NOT NULL, "customerName" varchar NOT NULL, "customerPhone" varchar NOT NULL, "customerWhatsapp" varchar NOT NULL DEFAULT '', "requestType" varchar NOT NULL DEFAULT 'OUTRIGHT', "offerAmount" decimal(18,2), "preferredContact" varchar NOT NULL DEFAULT 'PHONE', "tradeInDetails" text NOT NULL DEFAULT '', "message" text NOT NULL DEFAULT '', "status" varchar NOT NULL DEFAULT 'NEW'`],
      ['commerce_vehicle_reservations', `${base}, "vehicleId" uuid NOT NULL, "businessId" uuid NOT NULL, "reservationCode" varchar NOT NULL, "customerName" varchar NOT NULL, "customerPhone" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'HELD', "expiresAt" timestamptz NOT NULL`],

      ['lala_hotel_profiles', `${owned}, "hotelId" uuid NOT NULL, "listed" boolean NOT NULL DEFAULT false, "description" text NOT NULL DEFAULT '', "starRating" double precision NOT NULL DEFAULT 0, "amenities" jsonb NOT NULL DEFAULT ${jsonArray}, "images" jsonb NOT NULL DEFAULT ${jsonArray}, "latitude" varchar NOT NULL DEFAULT '', "longitude" varchar NOT NULL DEFAULT '', "policies" jsonb NOT NULL DEFAULT ${jsonObject}, "lastMinuteEnabled" boolean NOT NULL DEFAULT true, "reverseOffersEnabled" boolean NOT NULL DEFAULT true, "guestRating" double precision NOT NULL DEFAULT 0, "verifiedReviewCount" integer NOT NULL DEFAULT 0`],
      ['lala_room_types', `${owned}, "hotelId" uuid NOT NULL, "name" varchar NOT NULL, "description" text NOT NULL DEFAULT '', "capacity" integer NOT NULL DEFAULT 2, "baseRate" decimal(18,2) NOT NULL DEFAULT 0, "currency" varchar NOT NULL DEFAULT 'TZS', "amenities" jsonb NOT NULL DEFAULT ${jsonArray}, "images" jsonb NOT NULL DEFAULT ${jsonArray}, "active" boolean NOT NULL DEFAULT true`],
      ['lala_room_inventory', `${base}, "hotelId" uuid NOT NULL, "roomTypeId" uuid NOT NULL, "stayDate" date NOT NULL, "availableRooms" integer NOT NULL DEFAULT 0, "rate" decimal(18,2) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS', "source" varchar NOT NULL DEFAULT 'KOBEOS', "verifiedAt" timestamptz NOT NULL`],
      ['lala_passports', `${base}, "passportNumber" varchar NOT NULL, "qrToken" varchar NOT NULL, "phone" varchar NOT NULL, "name" varchar NOT NULL, "email" varchar NOT NULL DEFAULT '', "nationality" varchar NOT NULL DEFAULT '', "preferences" jsonb NOT NULL DEFAULT ${jsonObject}, "privacy" jsonb NOT NULL DEFAULT ${jsonObject}, "active" boolean NOT NULL DEFAULT true`],
      ['lala_guest_folios', `${base}, "bookingId" uuid NOT NULL, "hotelId" uuid NOT NULL, "passportId" uuid NOT NULL, "roomCharges" decimal(18,2) NOT NULL DEFAULT 0, "foodCharges" decimal(18,2) NOT NULL DEFAULT 0, "otherCharges" decimal(18,2) NOT NULL DEFAULT 0, "payments" decimal(18,2) NOT NULL DEFAULT 0, "status" varchar NOT NULL DEFAULT 'OPEN'`],
      ['lala_hotel_loyalty_programs', `${owned}, "hotelId" uuid NOT NULL, "name" varchar NOT NULL DEFAULT 'Hotel Loyalty', "active" boolean NOT NULL DEFAULT true, "programType" varchar NOT NULL DEFAULT 'POINTS', "pointsPerCurrencyUnit" decimal(12,4) NOT NULL DEFAULT 1, "welcomePoints" integer NOT NULL DEFAULT 0, "expiryDays" integer NOT NULL DEFAULT 365, "eligibility" jsonb NOT NULL DEFAULT ${jsonObject}, "tiers" jsonb NOT NULL DEFAULT ${jsonArray}, "rewards" jsonb NOT NULL DEFAULT ${jsonArray}`],
      ['lala_hotel_loyalty_accounts', `${base}, "hotelId" uuid NOT NULL, "passportId" uuid NOT NULL, "points" integer NOT NULL DEFAULT 0, "tier" varchar NOT NULL DEFAULT 'Member', "stays" integer NOT NULL DEFAULT 0, "lifetimeSpend" decimal(18,2) NOT NULL DEFAULT 0`],
      ['lala_rewards_accounts', `${base}, "passportId" uuid NOT NULL, "points" integer NOT NULL DEFAULT 0, "tier" varchar NOT NULL DEFAULT 'Explorer', "verifiedStays" integer NOT NULL DEFAULT 0`],
      ['lala_verified_stays', `${base}, "bookingId" uuid NOT NULL, "hotelId" uuid NOT NULL, "passportId" uuid NOT NULL, "checkIn" date NOT NULL, "checkOut" date NOT NULL, "eligibleSpend" decimal(18,2) NOT NULL DEFAULT 0, "hotelPointsEarned" integer NOT NULL DEFAULT 0, "lalaPointsEarned" integer NOT NULL DEFAULT 0, "reviewEligible" boolean NOT NULL DEFAULT true`],
      ['lala_reviews', `${base}, "verifiedStayId" uuid NOT NULL, "hotelId" uuid NOT NULL, "passportId" uuid NOT NULL, "rating" integer NOT NULL, "comment" text NOT NULL DEFAULT '', "verified" boolean NOT NULL DEFAULT true`],
      ['lala_reverse_requests', `${base}, "passportId" uuid NOT NULL, "destination" varchar NOT NULL, "checkIn" date NOT NULL, "checkOut" date NOT NULL, "guests" integer NOT NULL DEFAULT 1, "budget" decimal(18,2) NOT NULL DEFAULT 0, "currency" varchar NOT NULL DEFAULT 'TZS', "status" varchar NOT NULL DEFAULT 'OPEN'`],
      ['lala_hotel_offers', `${owned}, "requestId" uuid NOT NULL, "hotelId" uuid NOT NULL, "roomId" uuid NOT NULL, "totalPrice" decimal(18,2) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS', "message" text NOT NULL DEFAULT '', "expiresAt" timestamptz NOT NULL, "status" varchar NOT NULL DEFAULT 'ACTIVE'`],
      ['lala_corporate_accounts', `${base}, "name" varchar NOT NULL, "contactName" varchar NOT NULL DEFAULT '', "phone" varchar NOT NULL DEFAULT '', "email" varchar NOT NULL DEFAULT '', "type" varchar NOT NULL DEFAULT 'CORPORATE', "status" varchar NOT NULL DEFAULT 'ACTIVE'`],
      ['lala_group_booking_requests', `${base}, "corporateAccountId" uuid, "destination" varchar NOT NULL, "checkIn" date NOT NULL, "checkOut" date NOT NULL, "rooms" integer NOT NULL, "guests" integer NOT NULL, "status" varchar NOT NULL DEFAULT 'OPEN'`],

      ['accountant_financial_transactions', `${owned}, "sourceType" varchar NOT NULL, "sourceId" varchar NOT NULL, "direction" varchar NOT NULL DEFAULT 'IN', "amount" decimal(18,4) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS', "counterparty" varchar NOT NULL DEFAULT '', "reference" varchar NOT NULL DEFAULT '', "description" text NOT NULL DEFAULT '', "detectedAt" timestamptz NOT NULL, "status" varchar NOT NULL DEFAULT 'NEEDS_INFO', "raw" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['accountant_sms_transactions', `${owned}, "inboundPaymentId" uuid NOT NULL, "financialTransactionId" uuid NOT NULL, "transactionId" varchar NOT NULL, "provider" varchar NOT NULL, "rawMessage" text NOT NULL`],
      ['accountant_questions', `${owned}, "financialTransactionId" uuid NOT NULL, "question" text NOT NULL, "status" varchar NOT NULL DEFAULT 'OPEN', "escalateAt" timestamptz NOT NULL, "answeredAt" timestamptz, "answer" text NOT NULL DEFAULT '', "answeredVia" varchar NOT NULL DEFAULT 'CHAT'`],
      ['accountant_conversations', `${owned}, "questionId" uuid NOT NULL, "channel" varchar NOT NULL DEFAULT 'CHAT', "direction" varchar NOT NULL DEFAULT 'OUTBOUND', "content" text NOT NULL, "evidence" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['accountant_calls', `${owned}, "questionId" uuid NOT NULL, "provider" varchar NOT NULL, "providerCallId" varchar NOT NULL DEFAULT '', "callbackToken" varchar NOT NULL, "phone" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'QUEUED', "transcript" text NOT NULL DEFAULT '', "startedAt" timestamptz, "completedAt" timestamptz, "providerPayload" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['accountant_classifications', `${owned}, "financialTransactionId" uuid NOT NULL, "classificationType" varchar NOT NULL, "category" varchar NOT NULL, "accountCode" varchar NOT NULL DEFAULT '', "confidence" double precision NOT NULL DEFAULT 0, "rationale" text NOT NULL DEFAULT '', "ownerAnswer" text NOT NULL DEFAULT '', "evidence" jsonb NOT NULL DEFAULT ${jsonObject}, "journalTransactionIds" jsonb NOT NULL DEFAULT ${jsonArray}, "correctsClassificationId" uuid`],
      ['accountant_daily_closes', `${owned}, "closeDate" date NOT NULL, "status" varchar NOT NULL DEFAULT 'PRELIMINARY', "transactionCount" integer NOT NULL DEFAULT 0, "unresolvedCount" integer NOT NULL DEFAULT 0, "moneyIn" decimal(18,4) NOT NULL DEFAULT 0, "moneyOut" decimal(18,4) NOT NULL DEFAULT 0, "statements" jsonb NOT NULL DEFAULT ${jsonObject}, "completedAt" timestamptz`],

      ['transit_trip_location_events', `${owned}, "tripId" uuid NOT NULL, "busId" uuid NOT NULL, "checkpointId" uuid, "locationName" varchar NOT NULL DEFAULT '', "latitude" varchar NOT NULL DEFAULT '', "longitude" varchar NOT NULL DEFAULT '', "source" varchar NOT NULL DEFAULT 'CAMERA', "sourceEventId" varchar NOT NULL DEFAULT '', "occurredAt" timestamptz NOT NULL, "eta" timestamptz`],
      ['transit_trip_followers', `${owned}, "tripId" uuid NOT NULL, "phone" varchar NOT NULL, "name" varchar NOT NULL DEFAULT '', "pickupCheckpointId" uuid, "notifyBeforeMinutes" integer NOT NULL DEFAULT 30, "channels" jsonb NOT NULL DEFAULT ${jsonArray}, "active" boolean NOT NULL DEFAULT true`],
      ['transit_arrival_alerts', `${owned}, "tripId" uuid NOT NULL, "followerId" uuid NOT NULL, "eventKey" varchar NOT NULL, "kind" varchar NOT NULL, "message" text NOT NULL, "status" varchar NOT NULL DEFAULT 'PENDING', "sentAt" timestamptz`],
      ['transit_tickets', `${owned}, "tripId" uuid NOT NULL, "ticketNumber" varchar NOT NULL, "passengerName" varchar NOT NULL, "passengerPhone" varchar NOT NULL, "seatNumber" varchar NOT NULL, "fare" decimal(18,2) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS', "status" varchar NOT NULL DEFAULT 'RESERVED', "paymentReference" varchar NOT NULL DEFAULT ''`],
      ['transit_passenger_manifests', `${owned}, "tripId" uuid NOT NULL, "ticketId" uuid NOT NULL, "passengerName" varchar NOT NULL, "passengerPhone" varchar NOT NULL, "seatNumber" varchar NOT NULL, "boarded" boolean NOT NULL DEFAULT false, "boardedAt" timestamptz`],
      ['transit_vehicle_checkpoint_events', `${owned}, "vehicleType" varchar NOT NULL, "vehicleId" varchar NOT NULL, "checkpointId" uuid, "locationName" varchar NOT NULL DEFAULT '', "source" varchar NOT NULL DEFAULT 'CAMERA', "occurredAt" timestamptz NOT NULL, "metadata" jsonb NOT NULL DEFAULT ${jsonObject}`],
      ['transit_authority_grants', `${owned}, "authorityUserId" uuid NOT NULL, "role" varchar NOT NULL, "scope" jsonb NOT NULL DEFAULT ${jsonObject}, "active" boolean NOT NULL DEFAULT true, "grantedBy" varchar NOT NULL DEFAULT ''`],
      ['transit_bus_operator_history', `${owned}, "busId" uuid NOT NULL, "operatorId" uuid NOT NULL, "effectiveFrom" timestamptz NOT NULL, "effectiveTo" timestamptz, "reason" varchar NOT NULL DEFAULT '', "changedBy" varchar NOT NULL DEFAULT ''`],
    ];
    for (const [name, columns] of tables) await q.query(`CREATE TABLE IF NOT EXISTS "${name}" (${columns}, CONSTRAINT "PK_${name}" PRIMARY KEY ("id"))`);

    const indexes = [
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_business_id" ON "commerce_businesses" ("businessId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_business_slug" ON "commerce_businesses" ("publicSlug")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_shop_code" ON "commerce_shop_units" ("publicCode")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_shop_grid" ON "commerce_shop_units" ("ownerId","propertyId","floorId","unitNumber")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_floor" ON "commerce_property_floors" ("ownerId","propertyId","code")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_category_slug" ON "commerce_categories" ("slug")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_media_token" ON "commerce_product_media" ("publicToken") WHERE "publicToken" IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_node_business" ON "commerce_nodes" ("businessId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_snippet" ON "commerce_product_snippets" ("businessId","productId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_customer_phone" ON "commerce_customers" ("phone")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_order_number" ON "commerce_merchant_orders" ("orderNumber")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commerce_quota_business" ON "commerce_merchant_quotas" ("businessId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vehicle_reservation_code" ON "commerce_vehicle_reservations" ("reservationCode")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_profile" ON "lala_hotel_profiles" ("ownerId","hotelId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_room_type" ON "lala_room_types" ("ownerId","hotelId","name")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_inventory" ON "lala_room_inventory" ("hotelId","roomTypeId","stayDate")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_passport_phone" ON "lala_passports" ("phone")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_passport_qr" ON "lala_passports" ("qrToken")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_folio_booking" ON "lala_guest_folios" ("bookingId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_hotel_loyalty" ON "lala_hotel_loyalty_programs" ("ownerId","hotelId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_hotel_account" ON "lala_hotel_loyalty_accounts" ("hotelId","passportId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_rewards" ON "lala_rewards_accounts" ("passportId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_verified_stay" ON "lala_verified_stays" ("bookingId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_review_stay" ON "lala_reviews" ("verifiedStayId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lala_offer" ON "lala_hotel_offers" ("requestId","hotelId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_accountant_source" ON "accountant_financial_transactions" ("ownerId","sourceType","sourceId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_accountant_sms" ON "accountant_sms_transactions" ("ownerId","inboundPaymentId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_accountant_call_token" ON "accountant_calls" ("callbackToken")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_accountant_close" ON "accountant_daily_closes" ("ownerId","closeDate")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transit_follower" ON "transit_trip_followers" ("ownerId","tripId","phone")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transit_arrival_alert" ON "transit_arrival_alerts" ("ownerId","followerId","eventKey")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transit_ticket_number" ON "transit_tickets" ("ownerId","ticketNumber")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transit_trip_seat" ON "transit_tickets" ("ownerId","tripId","seatNumber")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transit_manifest_ticket" ON "transit_passenger_manifests" ("ownerId","ticketId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transit_authority_grant" ON "transit_authority_grants" ("ownerId","authorityUserId","role")`,
    ];
    for (const statement of indexes) await q.query(statement);
    await q.query(`ALTER TABLE "transit_cameras" ADD COLUMN IF NOT EXISTS "apiKeyHash" varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "transit_cameras" ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" timestamptz`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "transit_cameras" DROP COLUMN IF EXISTS "lastHeartbeatAt"`);
    await q.query(`ALTER TABLE "transit_cameras" DROP COLUMN IF EXISTS "apiKeyHash"`);
    const names = [
      'transit_authority_grants','transit_vehicle_checkpoint_events','transit_passenger_manifests','transit_tickets','transit_arrival_alerts','transit_trip_followers','transit_trip_location_events',
      'accountant_daily_closes','accountant_classifications','accountant_calls','accountant_conversations','accountant_questions','accountant_sms_transactions','accountant_financial_transactions',
      'lala_group_booking_requests','lala_corporate_accounts','lala_hotel_offers','lala_reverse_requests','lala_reviews','lala_verified_stays','lala_rewards_accounts','lala_hotel_loyalty_accounts','lala_hotel_loyalty_programs','lala_guest_folios','lala_passports','lala_room_inventory','lala_room_types','lala_hotel_profiles',
      'commerce_vehicle_reservations','commerce_vehicle_buyer_requests','commerce_vehicle_listing_metadata','commerce_vehicle_media','commerce_vehicles','commerce_interest_events','commerce_merchant_quotas','commerce_order_lines','commerce_merchant_orders','commerce_cart_lines','commerce_carts','commerce_customers','commerce_product_snippets','commerce_node_heartbeats','commerce_nodes','commerce_product_media','commerce_categories','commerce_merchant_claims','commerce_shop_units','commerce_property_floors','commerce_business_locations','commerce_businesses',
      'platform_notifications','platform_domain_events',
    ];
    for (const name of names) await q.query(`DROP TABLE IF EXISTS "${name}"`);
  }
}
