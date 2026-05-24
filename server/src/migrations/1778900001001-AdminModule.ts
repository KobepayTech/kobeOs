import { MigrationInterface, QueryRunner } from "typeorm";

export class AdminModule1778900001001 implements MigrationInterface {
    name = 'AdminModule1778900001001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "admin_companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL DEFAULT '', "country" character varying NOT NULL DEFAULT '', "plan" character varying NOT NULL DEFAULT 'Basic', "users" integer NOT NULL DEFAULT '0', "modules" integer NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'Active', "revenue" double precision NOT NULL DEFAULT '0', "joined" character varying, CONSTRAINT "PK_admin_companies" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_companies_ownerId" ON "admin_companies" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "admin_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "company" character varying NOT NULL, "plan" character varying NOT NULL DEFAULT 'Basic', "price" double precision NOT NULL DEFAULT '0', "startDate" character varying, "endDate" character varying, "status" character varying NOT NULL DEFAULT 'Active', "autoRenew" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_admin_subscriptions" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_subscriptions_ownerId" ON "admin_subscriptions" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "admin_invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "company" character varying NOT NULL, "amount" double precision NOT NULL DEFAULT '0', "date" character varying, "dueDate" character varying, "status" character varying NOT NULL DEFAULT 'Pending', CONSTRAINT "PK_admin_invoices" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_invoices_ownerId" ON "admin_invoices" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "admin_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "permissions" text NOT NULL DEFAULT '', "userCount" integer NOT NULL DEFAULT '0', "builtIn" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_admin_roles" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_roles_ownerId" ON "admin_roles" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "admin_tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "company" character varying NOT NULL, "subject" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'Open', "priority" character varying NOT NULL DEFAULT 'Medium', "created" character varying, CONSTRAINT "PK_admin_tickets" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_admin_tickets_ownerId" ON "admin_tickets" ("ownerId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_admin_tickets_ownerId"`);
        await queryRunner.query(`DROP TABLE "admin_tickets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admin_roles_ownerId"`);
        await queryRunner.query(`DROP TABLE "admin_roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admin_invoices_ownerId"`);
        await queryRunner.query(`DROP TABLE "admin_invoices"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admin_subscriptions_ownerId"`);
        await queryRunner.query(`DROP TABLE "admin_subscriptions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_admin_companies_ownerId"`);
        await queryRunner.query(`DROP TABLE "admin_companies"`);
    }

}
