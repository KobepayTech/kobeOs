import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kobepay Pro — school financial OS (Phase 1).
 * Double-entry ledger, student wallets, deposit engine, merchants & rules.
 * All statements are idempotent so re-runs and desktop auto-sync coexist.
 */
export class AddKobepayPro1782500000000 implements MigrationInterface {
  name = 'AddKobepayPro1782500000000';

  public async up(q: QueryRunner): Promise<void> {
    const owned = `
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL`;

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_schools" (${owned},
      "name" character varying NOT NULL,
      "code" character varying NOT NULL,
      "bankModel" character varying NOT NULL DEFAULT 'KOBEPAY',
      "bankAccountRef" character varying NOT NULL DEFAULT '',
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "settings" jsonb NOT NULL DEFAULT '{}',
      CONSTRAINT "PK_kp_schools" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_schools_owner" ON "kp_schools" ("ownerId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kp_schools_owner_code" ON "kp_schools" ("ownerId","code")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_students" (${owned},
      "schoolId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "studentCode" character varying NOT NULL,
      "className" character varying NOT NULL DEFAULT '',
      "nfcCardId" character varying NOT NULL DEFAULT '',
      "qrToken" character varying NOT NULL DEFAULT '',
      "parentName" character varying NOT NULL DEFAULT '',
      "parentPhone" character varying NOT NULL DEFAULT '',
      "status" character varying NOT NULL DEFAULT 'ACTIVE',
      "controls" jsonb NOT NULL DEFAULT '{}',
      CONSTRAINT "PK_kp_students" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_students_owner" ON "kp_students" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_students_owner_school" ON "kp_students" ("ownerId","schoolId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kp_students_owner_code" ON "kp_students" ("ownerId","studentCode")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_students_nfc" ON "kp_students" ("nfcCardId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_students_qr" ON "kp_students" ("qrToken")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_merchants" (${owned},
      "name" character varying NOT NULL,
      "merchantCode" character varying NOT NULL,
      "category" character varying NOT NULL DEFAULT 'AVAILABLE',
      "settlementAccount" character varying NOT NULL DEFAULT '',
      "settlementMethod" character varying NOT NULL DEFAULT 'mobile',
      "commissionPct" numeric(5,2) NOT NULL DEFAULT 0,
      "status" character varying NOT NULL DEFAULT 'PENDING',
      "online" boolean NOT NULL DEFAULT false,
      CONSTRAINT "PK_kp_merchants" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_merchants_owner" ON "kp_merchants" ("ownerId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kp_merchants_owner_code" ON "kp_merchants" ("ownerId","merchantCode")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_merchant_approvals" (${owned},
      "schoolId" uuid NOT NULL,
      "merchantId" uuid NOT NULL,
      "allowed" boolean NOT NULL DEFAULT true,
      CONSTRAINT "PK_kp_merchant_approvals" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_kp_merchant_approval" UNIQUE ("schoolId","merchantId"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_merchant_approvals_owner" ON "kp_merchant_approvals" ("ownerId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_accounts" (${owned},
      "type" character varying NOT NULL,
      "refId" character varying NOT NULL DEFAULT '',
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "balance" numeric(18,4) NOT NULL DEFAULT 0,
      CONSTRAINT "PK_kp_accounts" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_kp_account" UNIQUE ("ownerId","type","refId"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_accounts_owner" ON "kp_accounts" ("ownerId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_transactions" (${owned},
      "reference" character varying(16) NOT NULL,
      "kind" character varying NOT NULL,
      "status" character varying NOT NULL DEFAULT 'POSTED',
      "schoolId" uuid,
      "studentId" uuid,
      "merchantId" uuid,
      "category" character varying NOT NULL DEFAULT 'AVAILABLE',
      "amount" numeric(18,4) NOT NULL DEFAULT 0,
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "device" character varying NOT NULL DEFAULT '',
      "approvalRule" character varying NOT NULL DEFAULT '',
      "description" character varying NOT NULL DEFAULT '',
      "bankTransactionId" character varying NOT NULL DEFAULT '',
      "metadata" jsonb NOT NULL DEFAULT '{}',
      CONSTRAINT "PK_kp_transactions" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_txns_owner" ON "kp_transactions" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_txns_owner_created" ON "kp_transactions" ("ownerId","createdAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_txns_owner_student" ON "kp_transactions" ("ownerId","studentId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_txns_owner_merchant" ON "kp_transactions" ("ownerId","merchantId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_txns_banktx" ON "kp_transactions" ("bankTransactionId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_ledger_lines" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "transactionId" uuid NOT NULL,
      "accountId" uuid NOT NULL,
      "debit" numeric(18,4) NOT NULL DEFAULT 0,
      "credit" numeric(18,4) NOT NULL DEFAULT 0,
      "balanceAfter" numeric(18,4) NOT NULL DEFAULT 0,
      CONSTRAINT "PK_kp_ledger_lines" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_lines_owner" ON "kp_ledger_lines" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_lines_txn" ON "kp_ledger_lines" ("transactionId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_lines_account" ON "kp_ledger_lines" ("accountId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_wallets" (${owned},
      "studentId" uuid NOT NULL,
      "available" numeric(18,4) NOT NULL DEFAULT 0,
      "savings" numeric(18,4) NOT NULL DEFAULT 0,
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "spentToday" numeric(18,4) NOT NULL DEFAULT 0,
      "spentDay" date,
      CONSTRAINT "PK_kp_wallets" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_kp_wallet_student" UNIQUE ("studentId"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_wallets_owner" ON "kp_wallets" ("ownerId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_buckets" (${owned},
      "studentId" uuid NOT NULL,
      "category" character varying NOT NULL,
      "balance" numeric(18,4) NOT NULL DEFAULT 0,
      CONSTRAINT "PK_kp_buckets" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_kp_bucket" UNIQUE ("studentId","category"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_buckets_owner" ON "kp_buckets" ("ownerId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_reserved_holds" (${owned},
      "studentId" uuid NOT NULL,
      "purpose" character varying NOT NULL DEFAULT '',
      "groupId" uuid,
      "amount" numeric(18,4) NOT NULL DEFAULT 0,
      "status" character varying NOT NULL DEFAULT 'RESERVED',
      CONSTRAINT "PK_kp_reserved_holds" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_holds_owner" ON "kp_reserved_holds" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_holds_owner_student_status" ON "kp_reserved_holds" ("ownerId","studentId","status")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "kp_bank_deposits" (${owned},
      "bankTransactionId" character varying NOT NULL,
      "amount" numeric(18,4) NOT NULL DEFAULT 0,
      "currency" character varying NOT NULL DEFAULT 'TZS',
      "senderName" character varying NOT NULL DEFAULT '',
      "senderPhone" character varying NOT NULL DEFAULT '',
      "reference" character varying NOT NULL DEFAULT '',
      "matchedStudentId" uuid,
      "status" character varying NOT NULL DEFAULT 'UNMATCHED',
      "source" character varying NOT NULL DEFAULT 'MPESA_SMS',
      "rawMessage" text NOT NULL DEFAULT '',
      CONSTRAINT "PK_kp_bank_deposits" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_kp_bank_deposit_txid" UNIQUE ("bankTransactionId"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_deposits_owner" ON "kp_bank_deposits" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kp_deposits_owner_status" ON "kp_bank_deposits" ("ownerId","status")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of [
      'kp_bank_deposits', 'kp_reserved_holds', 'kp_buckets', 'kp_wallets',
      'kp_ledger_lines', 'kp_transactions', 'kp_accounts', 'kp_merchant_approvals',
      'kp_merchants', 'kp_students', 'kp_schools',
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
