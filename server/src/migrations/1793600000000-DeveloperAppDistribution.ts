import { MigrationInterface, QueryRunner } from 'typeorm';
export class DeveloperAppDistribution1793600000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE "developer_app_listings" ("appId" varchar(80) PRIMARY KEY, "publisherId" uuid NOT NULL)`);
    await q.query(`CREATE TABLE "developer_app_releases" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "appId" varchar(80) NOT NULL REFERENCES "developer_app_listings"("appId"), "publisherId" uuid NOT NULL, "version" varchar(32) NOT NULL,
      "manifest" jsonb NOT NULL, "html" text NOT NULL, "digest" varchar(64) NOT NULL,
      "status" varchar(16) NOT NULL DEFAULT 'pending', "reviewerId" uuid, "reviewNote" text NOT NULL DEFAULT '',
      CONSTRAINT "UQ_developer_app_version" UNIQUE ("appId", "version"),
      CONSTRAINT "CK_developer_app_status" CHECK ("status" IN ('pending','approved','rejected','revoked'))
    )`);
    await q.query(`CREATE TABLE "developer_app_installs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL, "appId" varchar(80) NOT NULL REFERENCES "developer_app_listings"("appId"),
      "releaseId" uuid NOT NULL REFERENCES "developer_app_releases"("id"), "grants" jsonb NOT NULL,
      CONSTRAINT "UQ_developer_app_owner" UNIQUE ("ownerId", "appId")
    )`);
    await q.query('CREATE INDEX "IDX_developer_app_publisher" ON "developer_app_releases" ("publisherId", "createdAt")');
    await q.query('CREATE INDEX "IDX_developer_app_status" ON "developer_app_releases" ("status")');
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE "developer_app_installs"');
    await q.query('DROP TABLE "developer_app_releases"');
    await q.query('DROP TABLE "developer_app_listings"');
  }
}
