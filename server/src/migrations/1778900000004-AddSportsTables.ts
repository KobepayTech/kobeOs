import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSportsTables1778900000004 implements MigrationInterface {
  name = 'AddSportsTables1778900000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sports_matches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "sport" varchar NOT NULL,
        "homeTeam" varchar NOT NULL,
        "awayTeam" varchar NOT NULL,
        "kickoff" timestamptz NOT NULL,
        "status" varchar NOT NULL DEFAULT 'SCHEDULED',
        "homeScore" int NOT NULL DEFAULT 0,
        "awayScore" int NOT NULL DEFAULT 0,
        "venue" varchar,
        "competition" varchar,
        "season" varchar,
        "homeLineup" jsonb,
        "awayLineup" jsonb,
        "stats" jsonb,
        "aiReport" text
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sports_matches_ownerId_kickoff" ON "sports_matches" ("ownerId", "kickoff")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sports_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "matchId" uuid NOT NULL,
        "type" varchar NOT NULL,
        "minute" int NOT NULL,
        "playerName" varchar,
        "team" varchar,
        "description" varchar,
        "metadata" jsonb
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sports_events_matchId_minute" ON "sports_events" ("matchId", "minute")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sports_players" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "name" varchar NOT NULL,
        "teamId" varchar,
        "teamName" varchar,
        "position" varchar,
        "nationality" varchar,
        "jerseyNumber" int,
        "rating" float NOT NULL DEFAULT 0,
        "stats" jsonb,
        "avatarUrl" varchar
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sports_players_ownerId_teamId" ON "sports_players" ("ownerId", "teamId")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sports_teams" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "name" varchar NOT NULL,
        "shortName" varchar,
        "competition" varchar,
        "logoUrl" varchar,
        "stadium" varchar,
        "country" varchar,
        "played" int NOT NULL DEFAULT 0,
        "won" int NOT NULL DEFAULT 0,
        "drawn" int NOT NULL DEFAULT 0,
        "lost" int NOT NULL DEFAULT 0,
        "goalsFor" int NOT NULL DEFAULT 0,
        "goalsAgainst" int NOT NULL DEFAULT 0,
        "points" int NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sports_teams_ownerId_competition" ON "sports_teams" ("ownerId", "competition")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sports_analytics" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ownerId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "matchId" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "possession" jsonb,
        "heatmaps" jsonb,
        "passingNetwork" jsonb,
        "playerTracking" jsonb,
        "offsideEvents" jsonb,
        "xgData" jsonb,
        "formations" jsonb,
        "aiCommentary" text,
        "aiTacticalReport" text
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sports_analytics_matchId" ON "sports_analytics" ("matchId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sports_analytics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sports_teams"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sports_players"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sports_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sports_matches"`);
  }
}
