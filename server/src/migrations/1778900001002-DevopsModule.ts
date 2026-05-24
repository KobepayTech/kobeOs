import { MigrationInterface, QueryRunner } from "typeorm";

export class DevopsModule1778900001002 implements MigrationInterface {
    name = 'DevopsModule1778900001002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dev_commits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "message" character varying NOT NULL, "author" character varying NOT NULL DEFAULT '', "module" character varying NOT NULL DEFAULT '', "branch" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'Open', "date" character varying, CONSTRAINT "PK_dev_commits" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dev_commits_ownerId" ON "dev_commits" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "dev_feature_flags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "module" character varying NOT NULL DEFAULT '', "description" character varying NOT NULL DEFAULT '', "status" character varying NOT NULL DEFAULT 'Disabled', "companiesAffected" integer NOT NULL DEFAULT '0', "createdBy" character varying NOT NULL DEFAULT '', "rolloutPercent" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_dev_feature_flags" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dev_feature_flags_ownerId" ON "dev_feature_flags" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "dev_deployments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "module" character varying NOT NULL, "environment" character varying NOT NULL DEFAULT 'Dev', "status" character varying NOT NULL DEFAULT 'Pending', "timestamp" character varying, "duration" character varying NOT NULL DEFAULT '', CONSTRAINT "PK_dev_deployments" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dev_deployments_ownerId" ON "dev_deployments" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "dev_issues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "title" character varying NOT NULL, "module" character varying NOT NULL DEFAULT '', "priority" character varying NOT NULL DEFAULT 'Medium', "status" character varying NOT NULL DEFAULT 'Open', "assignee" character varying NOT NULL DEFAULT '', "created" character varying, "comments" text, CONSTRAINT "PK_dev_issues" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dev_issues_ownerId" ON "dev_issues" ("ownerId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_dev_issues_ownerId"`);
        await queryRunner.query(`DROP TABLE "dev_issues"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dev_deployments_ownerId"`);
        await queryRunner.query(`DROP TABLE "dev_deployments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dev_feature_flags_ownerId"`);
        await queryRunner.query(`DROP TABLE "dev_feature_flags"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dev_commits_ownerId"`);
        await queryRunner.query(`DROP TABLE "dev_commits"`);
    }

}
