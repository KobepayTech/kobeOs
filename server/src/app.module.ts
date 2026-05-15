import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NotesModule } from './notes/notes.module';
import { TodoModule } from './todo/todo.module';
import { KanbanModule } from './kanban/kanban.module';
import { ContactsModule } from './contacts/contacts.module';
import { EmailModule } from './email/email.module';
import { ChatModule } from './chat/chat.module';
import { CalendarModule } from './calendar/calendar.module';
import { FilesModule } from './files/files.module';
import { PasswordsModule } from './passwords/passwords.module';
import { MediaModule } from './media/media.module';
import { CargoModule } from './cargo/cargo.module';
import { PropertyModule } from './property/property.module';
import { PosModule } from './pos/pos.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { DiscountsModule } from './discounts/discount.module';
import { PaymentsModule } from './payments/payments.module';
import { HotelModule } from './hotel/hotel.module';
import { CreatorsModule } from './creators/creators.module';
import { VideoGenerationModule } from './video-generation/video-generation.module';
import { AiModule } from './ai/ai.module';
import { RolesGuard } from './common/roles.guard';
import { LoggerMiddleware } from './common/logger.middleware';
import { RedisCacheModule } from './cache/redis-cache.module';
import { AuditModule } from './audit/audit.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync(databaseConfig),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'auth', ttl: 60_000, limit: 10 },
    ]),
    RedisCacheModule,
    AuditModule,
    WebhooksModule,
    VideoGenerationModule,
    AiModule,
    AuthModule,
    UsersModule,
    NotesModule,
    TodoModule,
    KanbanModule,
    ContactsModule,
    EmailModule,
    ChatModule,
    CalendarModule,
    FilesModule,
    PasswordsModule,
    MediaModule,
    CargoModule,
    PropertyModule,
    PosModule,
    WarehouseModule,
    DiscountsModule,
    PaymentsModule,
    HotelModule,
    CreatorsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
