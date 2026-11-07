/** Share URL/TLS handling between the Nest runtime and migration CLI. */
export function databaseConnection(
  env: Record<string, unknown>,
  migrations = false,
) {
  const url = migrations
    ? env.DATABASE_URL_UNPOOLED || env.DATABASE_URL
    : env.DATABASE_URL;
  if (typeof url === 'string' && url) {
    const parsed = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('DATABASE_URL must use postgres:// or postgresql://');
    }
    if (migrations && parsed.hostname.includes('-pooler.')) {
      throw new Error('Migrations require a direct DATABASE_URL_UNPOOLED');
    }
    // pg reads TLS options from the URL, including Neon sslmode/channel_binding.
    return { url };
  }
  return {
    host: String(env.DB_HOST || 'localhost'),
    port: Number(env.DB_PORT || 5432),
    username: String(env.DB_USERNAME || 'kobe'),
    password: String(env.DB_PASSWORD || 'kobe'),
    database: String(env.DB_DATABASE || 'kobeos'),
    ssl: env.DB_SSL === 'true'
      ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
  };
}
