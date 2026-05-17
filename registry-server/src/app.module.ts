import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { StoreRegistryModule } from './store-registry/store-registry.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.getOrThrow('DB_HOST'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.getOrThrow('DB_USERNAME'),
        password: cfg.getOrThrow('DB_PASSWORD'),
        database: cfg.getOrThrow('DB_DATABASE'),
        ssl: cfg.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: true, // safe — only 2 small tables
        logging: false,
      }),
    }),
    AuthModule,
    StoreRegistryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
