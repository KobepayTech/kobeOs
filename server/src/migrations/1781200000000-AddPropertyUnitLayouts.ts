import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertyUnitLayouts1781200000000 implements MigrationInterface {
  name = 'AddPropertyUnitLayouts1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "property_unit_layouts" (
        "id"             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt"      timestamptz NOT NULL DEFAULT now(),
        "updatedAt"      timestamptz NOT NULL DEFAULT now(),
        "ownerId"        uuid        NOT NULL,
        "propertyId"     uuid        NOT NULL,
        "unitId"         uuid        NOT NULL,
        "floor"          varchar     NOT NULL DEFAULT 'Ground',
        "corridor"       varchar     NOT NULL DEFAULT 'Main corridor',
        "corridorSide"   varchar     NOT NULL DEFAULT 'single',
        "position"       integer     NOT NULL DEFAULT 0,
        CONSTRAINT "CHK_property_unit_layout_side"
          CHECK ("corridorSide" IN ('left', 'right', 'end', 'single'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_property_unit_layout_owner_unit"
      ON "property_unit_layouts" ("ownerId", "unitId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_property_unit_layout_property"
      ON "property_unit_layouts" ("ownerId", "propertyId", "floor", "corridor", "position")
    `);

    // Existing units are placed into a safe default corridor so every property
    // immediately has a visual layout after upgrading.
    await queryRunner.query(`
      INSERT INTO "property_unit_layouts" (
        "ownerId", "propertyId", "unitId", "floor", "corridor", "corridorSide", "position"
      )
      SELECT
        u."ownerId",
        u."propertyId",
        u."id",
        COALESCE(NULLIF(u."floor", ''), 'Ground'),
        'Main corridor',
        'single',
        ROW_NUMBER() OVER (PARTITION BY u."ownerId", u."propertyId", COALESCE(NULLIF(u."floor", ''), 'Ground') ORDER BY u."unitNumber") - 1
      FROM "property_units" u
      ON CONFLICT ("ownerId", "unitId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "property_unit_layouts"');
  }
}
