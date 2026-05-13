import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { databaseConfig } from './config/database.config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync(databaseConfig),
    // Two buckets: a generous default for general API traffic and a tight
    // 'auth' bucket scoped to /api/auth/* (applied via @Throttle in AuthController).
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'auth', ttl: 60_000, limit: 10 },
    ]),
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
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
