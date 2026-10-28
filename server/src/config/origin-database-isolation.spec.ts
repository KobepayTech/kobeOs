import { readFileSync } from 'fs';
import { join } from 'path';
import { databaseConnection } from './database-connection';

/**
 * The main operational system and the online continuity database must stay
 * separate.
 *
 * databaseConnection() prefers DATABASE_URL over DB_HOST whenever it is set,
 * and the Neon CLI writes DATABASE_URL into a repository-root .env.local that
 * Nest also loads. So the origin backend has to have it removed from its
 * environment explicitly, or it connects to the cloud database instead of the
 * embedded cluster on 127.0.0.1:5433.
 *
 * It would not look like a failure: the release health gate would pass, the
 * supervisor would carry on managing a local cluster nothing uses, and the two
 * databases the allotment design exists to keep apart would be the same one —
 * leaving nothing for it to protect against.
 */
describe('origin database isolation', () => {
  it('prefers DATABASE_URL over the local fields, which is why the origin must clear it', () => {
    const resolved = databaseConnection({
      DATABASE_URL: 'postgresql://u:p@host-pooler.eu.neon.tech/neondb?sslmode=require',
      DB_HOST: '127.0.0.1',
      DB_PORT: '5433',
      DB_USERNAME: 'kobeos',
      DB_PASSWORD: 'kobeos_live',
      DB_DATABASE: 'kobeos',
    });
    expect(resolved).toHaveProperty('url');
    expect(resolved).not.toHaveProperty('host');
  });

  it('falls back to the embedded cluster once the URL is absent', () => {
    const resolved = databaseConnection({
      DB_HOST: '127.0.0.1',
      DB_PORT: '5433',
      DB_USERNAME: 'kobeos',
      DB_PASSWORD: 'kobeos_live',
      DB_DATABASE: 'kobeos',
    }) as Record<string, unknown>;
    expect(resolved.host).toBe('127.0.0.1');
    expect(resolved.port).toBe(5433);
    expect(resolved.database).toBe('kobeos');
  });

  it('an empty DATABASE_URL does not count as a URL', () => {
    // Blanking rather than deleting is the tempting half-fix; this pins that
    // the fallback still applies if someone does it that way.
    const resolved = databaseConnection({
      DATABASE_URL: '',
      DB_HOST: '127.0.0.1',
      DB_PORT: '5433',
    }) as Record<string, unknown>;
    expect(resolved.host).toBe('127.0.0.1');
  });

  /**
   * run-live-origin-supervisor.cjs calls main() at load, so it cannot be
   * imported and asserted against directly. Inspecting the source is the only
   * way to pin this, and the rule is important enough to pin: without it the
   * main system silently writes to the continuity database.
   */
  it('the origin supervisor strips both Neon URLs from the backend environment', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', '..', 'scripts', 'run-live-origin-supervisor.cjs'),
      'utf8',
    );

    // Deleted, not blanked: readProductionEnvironment copies whatever
    // .env.production holds, and an empty string is still a value a future
    // refactor of databaseConnection might treat as present.
    const strips = /delete\s+environment\[key\]/.test(source)
      && /'DATABASE_URL'\s*,\s*'DATABASE_URL_UNPOOLED'/.test(source);
    expect(strips).toBe(true);

    // And it still pins the embedded cluster explicitly.
    expect(source).toContain("DB_HOST: '127.0.0.1'");
    expect(source).toContain("const DB_PORT = '5433'");
  });
});
