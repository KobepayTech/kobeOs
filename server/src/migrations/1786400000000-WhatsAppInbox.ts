import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsAppInbox1786400000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_contacts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "phone" character varying NOT NULL,
        "displayName" character varying NOT NULL DEFAULT '',
        "lastMessageAt" TIMESTAMP WITH TIME ZONE,
        "optedOut" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_whatsapp_contacts" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_whatsapp_contacts_owner" ON "whatsapp_contacts" ("ownerId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_whatsapp_contacts_owner_phone" ON "whatsapp_contacts" ("ownerId", "phone")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "contactId" uuid NOT NULL,
        "direction" character varying(8) NOT NULL,
        "body" text NOT NULL,
        "externalId" character varying NOT NULL DEFAULT '',
        "note" text NOT NULL DEFAULT '',
        CONSTRAINT "PK_whatsapp_messages" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_whatsapp_messages_owner" ON "whatsapp_messages" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_whatsapp_messages_contact" ON "whatsapp_messages" ("contactId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_whatsapp_messages_external" ON "whatsapp_messages" ("externalId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        "webhookToken" character varying NOT NULL,
        "autoReply" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_whatsapp_settings" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_whatsapp_settings_owner" ON "whatsapp_settings" ("ownerId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_whatsapp_settings_token" ON "whatsapp_settings" ("webhookToken")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "whatsapp_messages"`);
    await q.query(`DROP TABLE IF EXISTS "whatsapp_contacts"`);
    await q.query(`DROP TABLE IF EXISTS "whatsapp_settings"`);
  }
}
