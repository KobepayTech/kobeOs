import 'reflect-metadata';
import { databaseConnection } from './database-connection';
import { validateEnv } from './env.validation';
import { envFiles } from './env-files';

const pooled = 'postgresql://user:secret@ep-example-pooler.eu.neon.tech/neondb?sslmode=require';
const direct = pooled.replace('-pooler', '');

describe('Neon database configuration', () => {
  it('never loads production dotenv files in the test environment', () => {
    expect(envFiles).toEqual([]);
  });
  it('uses the pooled URL for application traffic without overriding its TLS', () => {
    expect(databaseConnection({ DATABASE_URL: pooled, DB_HOST: 'localhost' }))
      .toEqual({ url: pooled });
  });

  it('uses the direct URL for migrations', () => {
    expect(databaseConnection({ DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct }, true))
      .toEqual({ url: direct });
  });

  it('rejects pooled migration connections before applying schema changes', () => {
    expect(() => databaseConnection({ DATABASE_URL: pooled }, true))
      .toThrow('Migrations require a direct DATABASE_URL_UNPOOLED');
  });

  it('retains local desktop connection defaults and explicit TLS options', () => {
    expect(databaseConnection({ DB_PORT: '5433', DB_SSL: 'true' }))
      .toMatchObject({ host: 'localhost', port: 5433, ssl: { rejectUnauthorized: true } });
  });

  it('validates a URL-only configuration without requiring legacy DB fields', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', PORT: 3000,
      JWT_SECRET: 'x'.repeat(32), DATABASE_URL: pooled })).not.toThrow();
  });

  it('still requires legacy DB fields when no URL is supplied', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', PORT: 3000,
      JWT_SECRET: 'x'.repeat(32) })).toThrow('DB_HOST');
  });
});
