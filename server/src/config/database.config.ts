import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const isDev = config.get('NODE_ENV', 'development') === 'development';
    const isDesktop = config.get('KOBEOS_DESKTOP', 'false') === 'true';
    // Allow schema sync in dev, or in the embedded desktop runtime (Electron/ISO).
    // Never sync in a plain production deployment — use migrations instead.
    const synchronize = (isDev || isDesktop) && config.get('DB_SYNCHRONIZE', 'true') === 'true';
    const migrationsRun = !isDev || config.get('DB_MIGRATIONS_RUN', 'false') === 'true';
    return {
      type: 'postgres',
      host: config.get('DB_HOST', 'localhost'),
      port: Number(config.get('DB_PORT', 5432)),
      username: config.get('DB_USERNAME', 'kobe'),
      password: config.get('DB_PASSWORD', 'kobe'),
      database: config.get('DB_DATABASE', 'kobeos'),
      autoLoadEntities: true,
      synchronize,
      migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
      migrationsTableName: 'kobeos_migrations',
      migrationsRun,
      logging: isDev ? ['error', 'warn'] : ['error'],
    };
  },
};
