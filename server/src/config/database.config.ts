import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const environment = config.get('NODE_ENV', 'development');
    const isDev = environment === 'development';
    const isTest = environment === 'test';
    // Desktop / per-shop installs (the Electron app sets KOBEOS_DESKTOP=true)
    // run a LOCAL single-tenant database that this exact app version owns.
    // synchronize auto-builds the full schema from the entities on every boot —
    // no migration maintenance, and the backend can never fail to start because
    // a table is missing (the cause of "Backend unreachable" on the desktop:
    // NODE_ENV=production ran migrations-only, and any gap crashed boot).
    // Real server deploys leave KOBEOS_DESKTOP unset and keep migrations.
    const isDesktop = config.get('KOBEOS_DESKTOP') === 'true';
    const synchronize =
      isDesktop ||
      ((isDev || isTest) && config.get('DB_SYNCHRONIZE', 'false') === 'true');
    // When synchronize owns the schema, don't also run migrations (they'd race
    // the auto-schema and can conflict). Otherwise run them on non-dev / when asked.
    const migrationsDefault = isDev || isTest ? 'false' : 'true';
    const migrationsRun =
      !synchronize &&
      config.get('DB_MIGRATIONS_RUN', migrationsDefault) === 'true';
    return {
      type: 'postgres',
      host: config.get('DB_HOST', 'localhost'),
      port: Number(config.get('DB_PORT', 5432)),
      username: config.get('DB_USERNAME', 'kobe'),
      password: config.get('DB_PASSWORD', 'kobe'),
      database: config.get('DB_DATABASE', 'kobeos'),
      ssl:
        config.get('DB_SSL', 'false') === 'true'
          ? {
              rejectUnauthorized:
                config.get('DB_SSL_REJECT_UNAUTHORIZED', 'true') !== 'false',
            }
          : false,
      autoLoadEntities: true,
      synchronize,
      // Migration filenames are timestamp-name.{ts,js}. Keep the glob strict so
      // compiled *.spec.js / *.test.js artifacts can never execute at startup.
      migrations: [
        join(
          __dirname,
          '..',
          'migrations',
          '+([0-9])-+([A-Za-z0-9_-]).{ts,js}',
        ),
      ],
      migrationsTableName: 'kobeos_migrations',
      migrationsRun,
      logging: isDev ? ['error', 'warn'] : ['error'],
      // First-boot of the bundled installer sometimes spawns Nest while the
      // embedded postgres cluster is still finishing initdb. Retry the
      // connection a handful of times so we don't surface a "the database
      // system is starting up" splash error to the user.
      retryAttempts: 30,
      retryDelay: 1_000,
    };
  },
};

