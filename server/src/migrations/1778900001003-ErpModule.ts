import { MigrationInterface, QueryRunner } from "typeorm";

export class ErpModule1778900001003 implements MigrationInterface {
    name = 'ErpModule1778900001003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "erp_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "code" character varying NOT NULL, "name" character varying NOT NULL, "type" character varying NOT NULL DEFAULT 'Asset', "balance" double precision NOT NULL DEFAULT '0', CONSTRAINT "PK_erp_accounts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_erp_accounts_ownerId" ON "erp_accounts" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "erp_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "date" character varying, "account" character varying NOT NULL DEFAULT '', "debit" double precision NOT NULL DEFAULT '0', "credit" double precision NOT NULL DEFAULT '0', "description" character varying NOT NULL DEFAULT '', CONSTRAINT "PK_erp_transactions" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_erp_transactions_ownerId" ON "erp_transactions" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "erp_loyalty_customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "phone" character varying NOT NULL DEFAULT '', "points" integer NOT NULL DEFAULT '0', "joinDate" character varying, "visits" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_erp_loyalty_customers" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_erp_loyalty_customers_ownerId" ON "erp_loyalty_customers" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "erp_loyalty_rewards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "points" integer NOT NULL DEFAULT '0', "image" character varying NOT NULL DEFAULT '', "stock" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_erp_loyalty_rewards" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_erp_loyalty_rewards_ownerId" ON "erp_loyalty_rewards" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "erp_loyalty_points" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "customer" character varying NOT NULL DEFAULT '', "type" character varying NOT NULL DEFAULT 'Earned', "points" integer NOT NULL DEFAULT '0', "description" character varying NOT NULL DEFAULT '', "date" character varying, CONSTRAINT "PK_erp_loyalty_points" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_erp_loyalty_points_ownerId" ON "erp_loyalty_points" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "erp_suppliers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "name" character varying NOT NULL, "contact" character varying NOT NULL DEFAULT '', "phone" character varying NOT NULL DEFAULT '', "country" character varying NOT NULL DEFAULT '', "rating" double precision NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'Active', CONSTRAINT "PK_erp_suppliers" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_erp_suppliers_ownerId" ON "erp_suppliers" ("ownerId") `);

        await queryRunner.query(`CREATE TABLE "erp_purchase_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" uuid NOT NULL, "poNumber" character varying NOT NULL, "supplier" character varying NOT NULL DEFAULT '', "total" double precision NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'Pending', "date" character varying, "deliveryDate" character varying, "items" text, CONSTRAINT "PK_erp_purchase_orders" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_erp_purchase_orders_ownerId" ON "erp_purchase_orders" ("ownerId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_erp_purchase_orders_ownerId"`);
        await queryRunner.query(`DROP TABLE "erp_purchase_orders"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_erp_suppliers_ownerId"`);
        await queryRunner.query(`DROP TABLE "erp_suppliers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_erp_loyalty_points_ownerId"`);
        await queryRunner.query(`DROP TABLE "erp_loyalty_points"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_erp_loyalty_rewards_ownerId"`);
        await queryRunner.query(`DROP TABLE "erp_loyalty_rewards"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_erp_loyalty_customers_ownerId"`);
        await queryRunner.query(`DROP TABLE "erp_loyalty_customers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_erp_transactions_ownerId"`);
        await queryRunner.query(`DROP TABLE "erp_transactions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_erp_accounts_ownerId"`);
        await queryRunner.query(`DROP TABLE "erp_accounts"`);
    }

}
