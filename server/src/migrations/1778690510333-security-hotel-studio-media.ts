import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityHotelStudioMedia1778690510333 implements MigrationInterface {
  name = 'SecurityHotelStudioMedia1778690510333';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "security_clients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "contactName" varchar NULL,
        "contactPhone" varchar NULL,
        "registrationNumber" varchar NULL,
        "active" boolean NOT NULL DEFAULT true
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_security_clients_owner" ON "security_clients" ("ownerId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_sites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "clientId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "address" varchar NOT NULL DEFAULT '',
        "plan" varchar NOT NULL DEFAULT 'standard',
        "zoneIds" text NOT NULL DEFAULT ''
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_client_sites_owner" ON "client_sites" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_client_sites_client" ON "client_sites" ("clientId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "phone" varchar NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "assignedSiteId" uuid NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_team_members_owner" ON "team_members" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_team_members_site" ON "team_members" ("assignedSiteId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_routes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "siteId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "checkpointNames" text NOT NULL DEFAULT '',
        "active" boolean NOT NULL DEFAULT true
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_service_routes_owner" ON "service_routes" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_service_routes_site" ON "service_routes" ("siteId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_checks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "routeId" uuid NOT NULL,
        "memberId" uuid NOT NULL,
        "checkpointName" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'checked',
        "checkedAt" timestamptz NOT NULL DEFAULT now(),
        "note" varchar NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_service_checks_owner" ON "service_checks" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_service_checks_route" ON "service_checks" ("routeId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_service_checks_member" ON "service_checks" ("memberId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_signals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "siteId" uuid NULL,
        "zoneId" varchar NOT NULL,
        "zoneName" varchar NOT NULL,
        "eventType" varchar NOT NULL DEFAULT 'signal',
        "severity" varchar NOT NULL DEFAULT 'info',
        "occupied" boolean NOT NULL DEFAULT false,
        "peopleCount" integer NOT NULL DEFAULT 0,
        "confidence" double precision NOT NULL DEFAULT 0,
        "raw" jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_site_signals_owner" ON "site_signals" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_site_signals_site" ON "site_signals" ("siteId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_site_signals_zone" ON "site_signals" ("zoneId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "clientId" uuid NULL,
        "siteId" uuid NULL,
        "title" varchar NOT NULL,
        "priority" varchar NOT NULL DEFAULT 'normal',
        "state" varchar NOT NULL DEFAULT 'open',
        "details" varchar NOT NULL DEFAULT ''
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_work_items_owner" ON "work_items" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_work_items_client" ON "work_items" ("clientId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_work_items_site" ON "work_items" ("siteId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_signal_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "roomId" uuid NOT NULL,
        "roomNumber" varchar NOT NULL,
        "zoneId" varchar NOT NULL,
        "active" boolean NOT NULL DEFAULT true
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_room_signal_links_owner" ON "hotel_room_signal_links" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_room_signal_links_room" ON "hotel_room_signal_links" ("roomId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_room_signal_links_number" ON "hotel_room_signal_links" ("roomNumber")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_room_signal_links_zone" ON "hotel_room_signal_links" ("zoneId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "roomId" uuid NOT NULL,
        "roomNumber" varchar NOT NULL,
        "risk" varchar NOT NULL DEFAULT 'normal',
        "state" varchar NOT NULL DEFAULT 'open',
        "title" varchar NOT NULL DEFAULT '',
        "summary" varchar NOT NULL DEFAULT '',
        "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_room_reviews_owner" ON "hotel_room_reviews" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_room_reviews_room" ON "hotel_room_reviews" ("roomId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_room_reviews_number" ON "hotel_room_reviews" ("roomNumber")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "studio_media_projects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "title" varchar NOT NULL,
        "section" varchar NOT NULL DEFAULT 'media-studios',
        "format" varchar NOT NULL DEFAULT 'short-video',
        "language" varchar NOT NULL DEFAULT 'English',
        "status" varchar NOT NULL DEFAULT 'draft',
        "engine" varchar NOT NULL DEFAULT 'MoneyPrinterTurbo',
        "prompt" varchar NOT NULL DEFAULT '',
        "outputUrl" varchar NULL,
        "companyId" uuid NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_studio_media_projects_owner" ON "studio_media_projects" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_studio_media_projects_company" ON "studio_media_projects" ("companyId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "studio_media_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "projectId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'queued',
        "engine" varchar NOT NULL DEFAULT 'MoneyPrinterTurbo',
        "requestPayload" varchar NOT NULL DEFAULT '',
        "resultPayload" varchar NOT NULL DEFAULT '',
        "outputUrl" varchar NULL,
        "errorMessage" varchar NULL,
        "startedAt" timestamptz NULL,
        "completedAt" timestamptz NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_studio_media_jobs_owner" ON "studio_media_jobs" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_studio_media_jobs_project" ON "studio_media_jobs" ("projectId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "studio_media_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "studio_media_projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_reviews"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_signal_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "work_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "site_signals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_checks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_routes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "client_sites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "security_clients"`);
  }
}
