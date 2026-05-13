import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVideoJobsTable1747160000001 implements MigrationInterface {
  name = 'AddVideoJobsTable1747160000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "video_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" character varying NOT NULL,
        "title" character varying NOT NULL,
        "topic" character varying,
        "script" text,
        "status" character varying NOT NULL DEFAULT 'pending',
        "errorMessage" character varying,
        "outputPath" character varying,
        "outputUrl" character varying,
        "config" jsonb,
        "progress" jsonb,
        "progressPercent" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        CONSTRAINT "PK_video_jobs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_video_jobs_owner" ON "video_jobs" ("ownerId", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "video_jobs"`);
  }
}
