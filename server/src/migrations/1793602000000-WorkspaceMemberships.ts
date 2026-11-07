import { MigrationInterface, QueryRunner } from 'typeorm';
export class WorkspaceMemberships1793602000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "business_workspace_members" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "memberId" uuid NOT NULL,
      "role" varchar NOT NULL DEFAULT 'viewer', "status" varchar NOT NULL DEFAULT 'INVITED', "acceptedAt" timestamptz,
      CONSTRAINT "UQ_business_workspace_member" UNIQUE ("ownerId", "memberId"))`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE IF EXISTS "business_workspace_members"'); }
}
