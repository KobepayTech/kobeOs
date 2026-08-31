import { MigrationInterface, QueryRunner } from 'typeorm';

export class DealershipCompletion1784800000000 implements MigrationInterface {
  name = 'DealershipCompletion1784800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "erp_crm_leads" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "businessId" uuid,
      "source" character varying NOT NULL DEFAULT 'MANUAL',
      "sourceRefId" character varying NOT NULL DEFAULT '',
      "customerName" character varying NOT NULL,
      "customerPhone" character varying NOT NULL DEFAULT '',
      "customerWhatsapp" character varying NOT NULL DEFAULT '',
      "customerEmail" character varying NOT NULL DEFAULT '',
      "subject" character varying NOT NULL DEFAULT '',
      "stage" character varying NOT NULL DEFAULT 'NEW',
      "value" numeric(18,2) NOT NULL DEFAULT '0',
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "assignedTo" character varying NOT NULL DEFAULT '',
      "nextActionAt" TIMESTAMP WITH TIME ZONE,
      "notes" text NOT NULL DEFAULT '',
      "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT "PK_erp_crm_leads" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_crm_owner_stage" ON "erp_crm_leads" ("ownerId","stage")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_crm_owner_business_phone" ON "erp_crm_leads" ("ownerId","businessId","customerPhone")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_crm_owner_source_ref" ON "erp_crm_leads" ("ownerId","source","sourceRefId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "erp_crm_activities" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "leadId" uuid NOT NULL,
      "type" character varying NOT NULL DEFAULT 'NOTE',
      "body" text NOT NULL DEFAULT '',
      "scheduledFor" TIMESTAMP WITH TIME ZONE,
      "completedAt" TIMESTAMP WITH TIME ZONE,
      "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT "PK_erp_crm_activities" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_erp_crm_activity_owner_lead_created" ON "erp_crm_activities" ("ownerId","leadId","createdAt")`);

    await q.query(`ALTER TABLE "commerce_vehicle_buyer_requests" ADD COLUMN IF NOT EXISTS "customerEmail" character varying NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE "commerce_vehicle_buyer_requests" ADD COLUMN IF NOT EXISTS "crmLeadId" uuid`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_vehicle_request_crm_lead" ON "commerce_vehicle_buyer_requests" ("crmLeadId")`);

    await q.query(`ALTER TABLE "commerce_vehicle_reservations" ADD COLUMN IF NOT EXISTS "crmLeadId" uuid`);
    await q.query(`ALTER TABLE "commerce_vehicle_reservations" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "commerce_vehicle_reservations" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "commerce_vehicle_reservations" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP WITH TIME ZONE`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_vehicle_reservation_crm_lead" ON "commerce_vehicle_reservations" ("crmLeadId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "commerce_vehicle_appointments" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "vehicleId" uuid NOT NULL,
      "businessId" uuid NOT NULL,
      "customerName" character varying NOT NULL,
      "customerPhone" character varying NOT NULL,
      "customerWhatsapp" character varying NOT NULL DEFAULT '',
      "customerEmail" character varying NOT NULL DEFAULT '',
      "appointmentType" character varying NOT NULL DEFAULT 'SHOWROOM',
      "scheduledFor" TIMESTAMP WITH TIME ZONE NOT NULL,
      "showroomLocation" character varying NOT NULL DEFAULT '',
      "salesperson" character varying NOT NULL DEFAULT '',
      "status" character varying NOT NULL DEFAULT 'REQUESTED',
      "message" text NOT NULL DEFAULT '',
      "crmLeadId" uuid,
      CONSTRAINT "PK_commerce_vehicle_appointments" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_vehicle_appointment_business_schedule" ON "commerce_vehicle_appointments" ("businessId","scheduledFor")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_vehicle_appointment_vehicle_schedule" ON "commerce_vehicle_appointments" ("vehicleId","scheduledFor")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_vehicle_appointment_crm_lead" ON "commerce_vehicle_appointments" ("crmLeadId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_vehicle_appointment_crm_lead"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_vehicle_appointment_vehicle_schedule"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_vehicle_appointment_business_schedule"`);
    await q.query(`DROP TABLE IF EXISTS "commerce_vehicle_appointments"`);

    await q.query(`DROP INDEX IF EXISTS "IDX_vehicle_reservation_crm_lead"`);
    await q.query(`ALTER TABLE "commerce_vehicle_reservations" DROP COLUMN IF EXISTS "convertedAt"`);
    await q.query(`ALTER TABLE "commerce_vehicle_reservations" DROP COLUMN IF EXISTS "cancelledAt"`);
    await q.query(`ALTER TABLE "commerce_vehicle_reservations" DROP COLUMN IF EXISTS "confirmedAt"`);
    await q.query(`ALTER TABLE "commerce_vehicle_reservations" DROP COLUMN IF EXISTS "crmLeadId"`);

    await q.query(`DROP INDEX IF EXISTS "IDX_vehicle_request_crm_lead"`);
    await q.query(`ALTER TABLE "commerce_vehicle_buyer_requests" DROP COLUMN IF EXISTS "crmLeadId"`);
    await q.query(`ALTER TABLE "commerce_vehicle_buyer_requests" DROP COLUMN IF EXISTS "customerEmail"`);

    await q.query(`DROP INDEX IF EXISTS "IDX_erp_crm_activity_owner_lead_created"`);
    await q.query(`DROP TABLE IF EXISTS "erp_crm_activities"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_erp_crm_owner_source_ref"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_erp_crm_owner_business_phone"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_erp_crm_owner_stage"`);
    await q.query(`DROP TABLE IF EXISTS "erp_crm_leads"`);
  }
}
