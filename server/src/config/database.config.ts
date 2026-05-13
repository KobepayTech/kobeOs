import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const synchronize = config.get<string>('DB_SYNCHRONIZE', 'true') === 'true';
    const migrationsRun = config.get<string>('DB_MIGRATIONS_RUN', 'false') === 'true';
    return {
      type: 'postgres',
      host: config.get<string>('DB_HOST', 'localhost'),
      port: Number(config.get('DB_PORT', 5432)),
      username: config.get<string>('DB_USERNAME', 'kobe'),
      password: config.get<string>('DB_PASSWORD', 'kobe'),
      database: config.get<string>('DB_DATABASE', 'kobeos'),
      autoLoadEntities: true,
      synchronize,
      migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
      migrationsTableName: 'kobeos_migrations',
      migrationsRun,
      logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
    };
  },
};
