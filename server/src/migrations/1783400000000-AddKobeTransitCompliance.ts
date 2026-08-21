import { MigrationInterface, QueryRunner } from 'typeorm';

const base = `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL`;

/**
 * KobeOS Transit core plus the auditable weekly-fee/compliance ledger. Foreign
 * keys are intentionally represented as indexed UUIDs, matching the rest of
 * KobeOS's owner-scoped modules and preserving historical records when a bus,
 * operator or plate is retired.
 */
export class AddKobeTransitCompliance1783400000000 implements MigrationInterface {
  name = 'AddKobeTransitCompliance1783400000000';

  public async up(q: QueryRunner): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS "transit_operators" (${base}, "name" varchar NOT NULL, "registrationNumber" varchar NOT NULL DEFAULT '', "phone" varchar NOT NULL DEFAULT '', "email" varchar NOT NULL DEFAULT '', "region" varchar NOT NULL DEFAULT '', "status" varchar NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "PK_transit_operators" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_operator_owner_name" ON "transit_operators" ("ownerId", "name")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_operator_owner" ON "transit_operators" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_routes" (${base}, "code" varchar NOT NULL, "name" varchar NOT NULL, "origin" varchar NOT NULL, "destination" varchar NOT NULL, "region" varchar NOT NULL DEFAULT '', "typicalMinutes" integer NOT NULL DEFAULT 0, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_transit_routes" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_route_owner_code" ON "transit_routes" ("ownerId", "code")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_route_owner" ON "transit_routes" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_checkpoints" (${base}, "routeId" uuid, "name" varchar NOT NULL, "region" varchar NOT NULL DEFAULT '', "latitude" varchar NOT NULL DEFAULT '', "longitude" varchar NOT NULL DEFAULT '', "sequence" integer NOT NULL DEFAULT 0, "minutesToDestination" integer NOT NULL DEFAULT 0, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_transit_checkpoints" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_checkpoint_route" ON "transit_checkpoints" ("ownerId", "routeId", "sequence")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_checkpoint_owner" ON "transit_checkpoints" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_cameras" (${base}, "code" varchar NOT NULL, "name" varchar NOT NULL, "checkpointId" uuid, "location" varchar NOT NULL DEFAULT '', "direction" varchar NOT NULL DEFAULT 'BOTH', "confidenceThreshold" double precision NOT NULL DEFAULT 0.85, "apiKeyHash" varchar NOT NULL DEFAULT '', "lastHeartbeatAt" timestamptz, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_transit_cameras" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_camera_owner_code" ON "transit_cameras" ("ownerId", "code")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_camera_owner" ON "transit_cameras" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_buses" (${base}, "operatorId" uuid NOT NULL, "vehicleIdentity" varchar NOT NULL, "name" varchar NOT NULL, "defaultOrigin" varchar NOT NULL DEFAULT '', "defaultDestination" varchar NOT NULL DEFAULT '', "routeId" uuid, "conductorName" varchar NOT NULL DEFAULT '', "conductorPhone" varchar NOT NULL DEFAULT '', "capacity" integer NOT NULL DEFAULT 0, "registrationStatus" varchar NOT NULL DEFAULT 'ACTIVE', "complianceStatus" varchar NOT NULL DEFAULT 'DUE_SOON', "paidThrough" timestamptz, "currentPlateId" uuid, "currentLocation" varchar NOT NULL DEFAULT '', "lastSeenAt" timestamptz, "suspended" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_transit_buses" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_bus_identity" ON "transit_buses" ("vehicleIdentity")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_bus_operator" ON "transit_buses" ("ownerId", "operatorId")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_bus_owner" ON "transit_buses" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_plates" (${base}, "busId" uuid NOT NULL, "plateNumber" varchar NOT NULL, "normalizedPlate" varchar NOT NULL, "active" boolean NOT NULL DEFAULT true, "effectiveFrom" timestamptz NOT NULL, "effectiveTo" timestamptz, "replacedPlateId" uuid, CONSTRAINT "PK_transit_plates" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_plate_owner_number" ON "transit_plates" ("ownerId", "normalizedPlate")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_plate_bus_active" ON "transit_plates" ("ownerId", "busId", "active")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_plate_owner" ON "transit_plates" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_trips" (${base}, "busId" uuid NOT NULL, "routeId" uuid, "tripCode" varchar NOT NULL, "origin" varchar NOT NULL, "destination" varchar NOT NULL, "scheduledDeparture" timestamptz NOT NULL, "actualDeparture" timestamptz, "scheduledArrival" timestamptz, "eta" timestamptz, "actualArrival" timestamptz, "status" varchar NOT NULL DEFAULT 'SCHEDULED', "gate" varchar NOT NULL DEFAULT '', "currentCheckpoint" varchar NOT NULL DEFAULT '', "delayMinutes" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_transit_trips" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_trip_owner_code" ON "transit_trips" ("ownerId", "tripCode")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_trip_bus_status" ON "transit_trips" ("ownerId", "busId", "status")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_trip_owner" ON "transit_trips" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_plate_detections" (${base}, "observedPlate" varchar NOT NULL, "normalizedPlate" varchar NOT NULL, "cameraId" uuid NOT NULL, "checkpointId" uuid, "busId" uuid, "tripId" uuid, "confidence" double precision NOT NULL, "direction" varchar NOT NULL DEFAULT '', "imageUrl" varchar NOT NULL DEFAULT '', "detectedAt" timestamptz NOT NULL, "reviewStatus" varchar NOT NULL DEFAULT 'AUTOMATIC', "complianceStatus" varchar NOT NULL DEFAULT '', CONSTRAINT "PK_transit_plate_detections" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_detection_plate_time" ON "transit_plate_detections" ("ownerId", "normalizedPlate", "detectedAt")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_detection_owner" ON "transit_plate_detections" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_fee_policies" (${base}, "feeAmount" decimal(18,2) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS', "periodDays" integer NOT NULL DEFAULT 7, "effectiveAt" timestamptz NOT NULL, "graceDays" integer NOT NULL DEFAULT 2, "dueSoonDays" integer NOT NULL DEFAULT 2, "governmentPercent" decimal(7,4) NOT NULL DEFAULT 50, "kobePercent" decimal(7,4) NOT NULL DEFAULT 50, "enforcementRules" text NOT NULL DEFAULT '{}', "exemptionRules" text NOT NULL DEFAULT '{}', "automaticAnprThreshold" double precision NOT NULL DEFAULT 0.85, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_transit_fee_policies" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_policy_owner_active" ON "transit_fee_policies" ("ownerId", "active")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_policy_owner" ON "transit_fee_policies" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_fee_periods" (${base}, "busId" uuid NOT NULL, "plateId" uuid NOT NULL, "policyId" uuid NOT NULL, "periodStart" timestamptz NOT NULL, "periodEnd" timestamptz NOT NULL, "dueAt" timestamptz NOT NULL, "paidAt" timestamptz, "paymentId" uuid, "amountDue" decimal(18,2) NOT NULL, "amountPaid" decimal(18,2) NOT NULL DEFAULT 0, "status" varchar NOT NULL DEFAULT 'DUE_SOON', CONSTRAINT "PK_transit_fee_periods" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_fee_period_bus_start" ON "transit_fee_periods" ("ownerId", "busId", "periodStart")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_fee_period_owner" ON "transit_fee_periods" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_fee_payments" (${base}, "operatorId" uuid NOT NULL, "amount" decimal(18,2) NOT NULL, "currency" varchar NOT NULL DEFAULT 'TZS', "method" varchar NOT NULL, "externalReference" varchar NOT NULL, "verificationReference" varchar NOT NULL, "paymentReference" varchar NOT NULL, "receiptNumber" varchar NOT NULL, "idempotencyKey" varchar NOT NULL, "verified" boolean NOT NULL DEFAULT false, "verifiedAt" timestamptz, "busCount" integer NOT NULL DEFAULT 1, "status" varchar NOT NULL DEFAULT 'VERIFIED', CONSTRAINT "PK_transit_fee_payments" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_payment_owner_idempotency" ON "transit_fee_payments" ("ownerId", "idempotencyKey")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_payment_owner_reference" ON "transit_fee_payments" ("ownerId", "paymentReference")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_payment_owner_external" ON "transit_fee_payments" ("ownerId", "externalReference")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_payment_owner" ON "transit_fee_payments" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_fee_allocations" (${base}, "paymentId" uuid NOT NULL, "feePeriodId" uuid NOT NULL, "busId" uuid NOT NULL, "plateId" uuid NOT NULL, "grossAmount" decimal(18,2) NOT NULL, "governmentAmount" decimal(18,2) NOT NULL, "kobeAmount" decimal(18,2) NOT NULL, "processingFee" decimal(18,2) NOT NULL DEFAULT 0, "settlementStatus" varchar NOT NULL DEFAULT 'ACCRUED', "settlementId" uuid, CONSTRAINT "PK_transit_fee_allocations" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_allocation_payment_bus" ON "transit_fee_allocations" ("ownerId", "paymentId", "busId")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_allocation_settlement_status" ON "transit_fee_allocations" ("ownerId", "settlementStatus")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_allocation_owner" ON "transit_fee_allocations" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_unpaid_detections" (${base}, "detectionId" uuid NOT NULL, "busId" uuid NOT NULL, "plateId" uuid NOT NULL, "policyId" uuid, "outstandingAmount" decimal(18,2) NOT NULL, "checkpointName" varchar NOT NULL DEFAULT '', "imageUrl" varchar NOT NULL DEFAULT '', "status" varchar NOT NULL DEFAULT 'OPEN', "resolvedAt" timestamptz, CONSTRAINT "PK_transit_unpaid_detections" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_unpaid_bus_status" ON "transit_unpaid_detections" ("ownerId", "busId", "status")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_unpaid_owner" ON "transit_unpaid_detections" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_enforcement_alerts" (${base}, "unpaidDetectionId" uuid NOT NULL, "detectionId" uuid NOT NULL, "busId" uuid NOT NULL, "plateId" uuid NOT NULL, "destination" varchar NOT NULL DEFAULT 'TRAFFIC_GOVERNMENT_DASHBOARD', "message" text NOT NULL, "status" varchar NOT NULL DEFAULT 'OPEN', "resolvedAt" timestamptz, "resolutionNote" varchar NOT NULL DEFAULT '', CONSTRAINT "PK_transit_enforcement_alerts" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_alert_bus_status" ON "transit_enforcement_alerts" ("ownerId", "busId", "status")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_alert_owner" ON "transit_enforcement_alerts" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_exemptions" (${base}, "busId" uuid NOT NULL, "exemptionType" varchar NOT NULL, "authority" varchar NOT NULL, "reason" text NOT NULL, "effectiveAt" timestamptz NOT NULL, "expiresAt" timestamptz NOT NULL, "supportingDocumentUrl" varchar NOT NULL DEFAULT '', "createdBy" varchar NOT NULL DEFAULT '', "approvedBy" varchar NOT NULL DEFAULT '', "status" varchar NOT NULL DEFAULT 'PENDING', CONSTRAINT "PK_transit_exemptions" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_exemption_bus_status" ON "transit_exemptions" ("ownerId", "busId", "status")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_exemption_owner" ON "transit_exemptions" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_off_road_periods" (${base}, "busId" uuid NOT NULL, "reason" text NOT NULL, "startsAt" timestamptz NOT NULL, "endsAt" timestamptz NOT NULL, "evidenceUrl" varchar NOT NULL DEFAULT '', "approvedBy" varchar NOT NULL DEFAULT '', "status" varchar NOT NULL DEFAULT 'PENDING', "feeTreatment" varchar NOT NULL DEFAULT 'NORMAL', CONSTRAINT "PK_transit_off_road_periods" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_offroad_bus_status" ON "transit_off_road_periods" ("ownerId", "busId", "status")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_offroad_owner" ON "transit_off_road_periods" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_payment_disputes" (${base}, "busId" uuid NOT NULL, "transactionId" varchar NOT NULL, "amount" decimal(18,2) NOT NULL, "paymentProvider" varchar NOT NULL, "paymentDate" timestamptz NOT NULL, "receiptUrl" varchar NOT NULL DEFAULT '', "explanation" text NOT NULL, "status" varchar NOT NULL DEFAULT 'SUBMITTED', "resolutionNote" varchar NOT NULL DEFAULT '', CONSTRAINT "PK_transit_payment_disputes" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_dispute_bus_status" ON "transit_payment_disputes" ("ownerId", "busId", "status")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_dispute_owner" ON "transit_payment_disputes" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_government_settlements" (${base}, "settlementReference" varchar NOT NULL, "periodStart" timestamptz NOT NULL, "periodEnd" timestamptz NOT NULL, "grossAmount" decimal(18,2) NOT NULL, "governmentAmount" decimal(18,2) NOT NULL, "kobeAmount" decimal(18,2) NOT NULL, "processingFees" decimal(18,2) NOT NULL DEFAULT 0, "settledAmount" decimal(18,2) NOT NULL DEFAULT 0, "status" varchar NOT NULL DEFAULT 'ACCRUED', "paymentReference" varchar NOT NULL DEFAULT '', "settledAt" timestamptz, "reconciledAt" timestamptz, "reconciliationNote" varchar NOT NULL DEFAULT '', CONSTRAINT "PK_transit_government_settlements" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_settlement_owner_reference" ON "transit_government_settlements" ("ownerId", "settlementReference")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_settlement_owner" ON "transit_government_settlements" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_government_settlement_lines" (${base}, "settlementId" uuid NOT NULL, "allocationId" uuid NOT NULL, "paymentId" uuid NOT NULL, "busId" uuid NOT NULL, "plateId" uuid NOT NULL, "governmentAmount" decimal(18,2) NOT NULL, CONSTRAINT "PK_transit_government_settlement_lines" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_settlement_line_unique" ON "transit_government_settlement_lines" ("ownerId", "settlementId", "allocationId")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_settlement_line_owner" ON "transit_government_settlement_lines" ("ownerId")`,

      `CREATE TABLE IF NOT EXISTS "transit_compliance_audits" (${base}, "busId" uuid NOT NULL, "plateId" uuid, "eventType" varchar NOT NULL, "eventKey" varchar NOT NULL, "fromStatus" varchar NOT NULL DEFAULT '', "toStatus" varchar NOT NULL DEFAULT '', "message" text NOT NULL DEFAULT '', "metadata" text NOT NULL DEFAULT '{}', CONSTRAINT "PK_transit_compliance_audits" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transit_audit_owner_key" ON "transit_compliance_audits" ("ownerId", "eventKey")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_audit_bus_created" ON "transit_compliance_audits" ("ownerId", "busId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "IDX_transit_audit_owner" ON "transit_compliance_audits" ("ownerId")`,
    ];
    for (const statement of statements) await q.query(statement);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'transit_compliance_audits', 'transit_government_settlement_lines', 'transit_government_settlements',
      'transit_payment_disputes', 'transit_off_road_periods', 'transit_exemptions', 'transit_enforcement_alerts',
      'transit_unpaid_detections', 'transit_fee_allocations', 'transit_fee_payments', 'transit_fee_periods',
      'transit_fee_policies', 'transit_plate_detections', 'transit_trips', 'transit_plates', 'transit_buses',
      'transit_cameras', 'transit_checkpoints', 'transit_routes', 'transit_operators',
    ]) await q.query(`DROP TABLE IF EXISTS "${table}"`);
  }
}
