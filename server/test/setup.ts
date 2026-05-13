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
  // Use synchronize to materialise the schema in the e2e DB without depending
  // on migration ordering. The prod path is exercised separately.
  process.env.DB_SYNCHRONIZE = 'true';
  process.env.DB_MIGRATIONS_RUN = 'false';
  process.env.DB_DATABASE = process.env.DB_DATABASE_E2E ?? 'kobeos_e2e';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
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
  const tables = [
    'refresh_tokens', 'password_resets',
    'chat_messages', 'chat_channels',
    'notes', 'todo_items', 'todo_lists',
    'kanban_cards', 'kanban_columns', 'kanban_boards',
    'contacts', 'emails', 'calendar_events',
    'vfs_nodes', 'password_entries', 'playlists', 'media_assets',
    'parcels', 'shipments', 'cargo_drivers', 'cargo_flights',
    'rent_payments', 'tenants', 'property_units', 'properties',
    'pos_order_items', 'pos_orders', 'pos_products',
    'warehouse_movements', 'warehouse_items',
    'discount_rules', 'coupons', 'campaigns',
    'payment_transactions', 'credit_loans', 'wallets',
    'hotel_bookings', 'hotel_guests', 'hotel_rooms',
    'creators', 'users',
  ];
  await ds.query(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE`);
}
