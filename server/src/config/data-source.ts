import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { databaseConnection } from './database-connection';
import { envFiles } from './env-files';

for (const path of envFiles) loadEnv({ path });

/**
 * TypeORM DataSource used by the migration CLI.
 * Entities are picked up via glob to avoid a manual import list drifting
 * out of sync with the app modules.
 */
export default new DataSource({
  type: 'postgres',
  ...databaseConnection(process.env, true),
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/+([0-9])-+([A-Za-z0-9_-]).ts'],
  migrationsTableName: 'kobeos_migrations',
});

