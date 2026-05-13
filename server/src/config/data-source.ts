import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

loadEnv();

/**
 * TypeORM DataSource used by the migration CLI.
 * Entities are picked up via glob to avoid a manual import list drifting
 * out of sync with the app modules.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'kobe',
  password: process.env.DB_PASSWORD || 'kobe',
  database: process.env.DB_DATABASE || 'kobeos',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'kobeos_migrations',
});
