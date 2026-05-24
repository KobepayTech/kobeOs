import { MigrationInterface, QueryRunner } from "typeorm";

export class PrintModule1778900001000 implements MigrationInterface {
    name = 'PrintModule1778900001000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "print_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "category" character varying NOT NULL DEFAULT '', "basePrice" double precision NOT NULL DEFAULT '0', "method" character varying NOT NULL DEFAULT '', "active" boolean NOT NULL DEFAULT true, "icon" character varying, CONSTRAINT "PK_print_products" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_print_products_ownerId" ON "print_products" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "print_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "product" character varying NOT NULL, "customer" character varying NOT NULL DEFAULT '', "method" character varying NOT NULL DEFAULT '', "qty" integer NOT NULL DEFAULT '1', "priority" character varying NOT NULL DEFAULT 'Medium', "status" character varying NOT NULL DEFAULT 'Pending', "dueDate" character varying, CONSTRAINT "PK_print_jobs" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_print_jobs_ownerId" ON "print_jobs" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "print_materials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "type" character varying NOT NULL DEFAULT '', "stock" double precision NOT NULL DEFAULT '0', "unit" character varying NOT NULL DEFAULT 'pcs', "minThreshold" double precision NOT NULL DEFAULT '0', "color" character varying, CONSTRAINT "PK_print_materials" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_print_materials_ownerId" ON "print_materials" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "print_customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "contact" character varying NOT NULL DEFAULT '', "phone" character varying NOT NULL DEFAULT '', "email" character varying, "status" character varying NOT NULL DEFAULT 'Active', "orders" integer NOT NULL DEFAULT '0', "totalSpent" double precision NOT NULL DEFAULT '0', CONSTRAINT "PK_print_customers" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_print_customers_ownerId" ON "print_customers" ("ownerId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_print_customers_ownerId"`);
        await queryRunner.query(`DROP TABLE "print_customers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_print_materials_ownerId"`);
        await queryRunner.query(`DROP TABLE "print_materials"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_print_jobs_ownerId"`);
        await queryRunner.query(`DROP TABLE "print_jobs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_print_products_ownerId"`);
        await queryRunner.query(`DROP TABLE "print_products"`);
    }

}
