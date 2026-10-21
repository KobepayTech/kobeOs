import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

/**
 * Bring up the full Nest app against the local test Postgres. Caller is
 * responsible for cleaning per-test data; we truncate users + dependent
 * tables to keep specs hermetic.
 */
export async function bootTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.PORT = process.env.PORT ?? '3001';
  process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
  process.env.DB_PORT = process.env.DB_PORT ?? '5432';
  process.env.DB_USERNAME = process.env.DB_USERNAME ?? 'kobe';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'kobe';
  // Build the e2e schema the way production does: migrations, not
  // synchronize. Overriding these here is what hid a production-only defect —
  // a transfer wrote two rows under one idempotency key, which the migration's
  // global unique index rejected and the entity-generated schema allowed, so
  // the bug could not fail a test. Respect the environment so CI can choose,
  // and default to the production path rather than the convenient one.
  process.env.DB_SYNCHRONIZE = process.env.DB_SYNCHRONIZE ?? 'false';
  process.env.DB_MIGRATIONS_RUN = process.env.DB_MIGRATIONS_RUN ?? 'true';
  process.env.DB_DATABASE = process.env.DB_DATABASE_E2E ?? 'kobeos_e2e';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-32-chars-minimum-ok';
  process.env.JWT_EXPIRES_IN = '15m';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

/** Wipe all per-user data between specs so suites can't interfere. */
export async function resetDb(app: INestApplication) {
  const ds = app.get(DataSource);
  const tables = await ds.query<Array<{ tablename: string }>>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'kobeos_migrations'
    ORDER BY tablename
  `);
  if (!tables.length) return;

  const identifiers = tables.map(({ tablename }) =>
    `"${tablename.replaceAll('"', '""')}"`,
  );
  await ds.query(`TRUNCATE TABLE ${identifiers.join(', ')} RESTART IDENTITY CASCADE`);
}
