import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get<string>('DB_HOST', 'localhost'),
    port: Number(config.get('DB_PORT', 5432)),
    username: config.get<string>('DB_USERNAME', 'kobe'),
    password: config.get<string>('DB_PASSWORD', 'kobe'),
    database: config.get<string>('DB_DATABASE', 'kobeos'),
    autoLoadEntities: true,
    synchronize: config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
    logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
  }),
};
