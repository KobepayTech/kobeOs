import { MigrationInterface, QueryRunner } from 'typeorm';

/** "Chat with your documents": uploaded docs + their embedded passages. */
export class AddAiDocuments1781900000000 implements MigrationInterface {
  name = 'AddAiDocuments1781900000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "ai_documents" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "title" character varying NOT NULL DEFAULT '',
      "source" character varying NOT NULL DEFAULT '',
      "chunkCount" integer NOT NULL DEFAULT 0,
      "charCount" integer NOT NULL DEFAULT 0,
      CONSTRAINT "PK_ai_documents" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_documents_owner" ON "ai_documents" ("ownerId")`);

    await q.query(`CREATE TABLE IF NOT EXISTS "ai_doc_chunks" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "ownerId" uuid NOT NULL,
      "documentId" uuid NOT NULL,
      "title" character varying NOT NULL DEFAULT '',
      "idx" integer NOT NULL DEFAULT 0,
      "text" text NOT NULL DEFAULT '',
      "vector" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "model" character varying NOT NULL DEFAULT '',
      CONSTRAINT "PK_ai_doc_chunks" PRIMARY KEY ("id")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_doc_chunks_owner" ON "ai_doc_chunks" ("ownerId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_ai_doc_chunks_owner_doc" ON "ai_doc_chunks" ("ownerId", "documentId")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "ai_doc_chunks"`);
    await q.query(`DROP TABLE IF EXISTS "ai_documents"`);
  }
}
