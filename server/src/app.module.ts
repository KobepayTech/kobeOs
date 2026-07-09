import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { AirCargoModule } from './cargo/air-cargo.module';
import { ShopsModule } from './shops/shops.module';
import { EodModule } from './eod/eod.module';
import { PropertyModule } from './property/property.module';
import { PosModule } from './pos/pos.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FxModule } from './fx/fx.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { PushModule } from './push/push.module';
import { KobeTokensModule } from './tokens/kobe-tokens.module';
import { MzigoModule } from './mzigo/mzigo.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { DiscountsModule } from './discounts/discount.module';
import { PaymentsModule } from './payments/payments.module';
import { CreditModule } from './credit/credit.module';
import { HotelModule } from './hotel/hotel.module';
import { CreatorsModule } from './creators/creators.module';
import { VideoGenerationModule } from './video-generation/video-generation.module';
import { AiModule } from './ai/ai.module';
import { OcrModule } from './ocr/ocr.module';
import { OrderFromImageModule } from './order-from-image/order-from-image.module';
import { TranslationModule } from './translation/translation.module';
import { ImageEditModule } from './image-edit/image-edit.module';
import { SystemModule } from './system/system.module';
import { CompaniesModule } from './companies/companies.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { StoreSettingsModule } from './store-settings/store-settings.module';
import { StoreModule } from './store/store.module';
import { StoreRegistryModule } from './store-registry/store-registry.module';
import { RolesGuard } from './common/roles.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { LoggerMiddleware } from './common/logger.middleware';
import { TenantMiddleware } from './store-settings/tenant.middleware';
import { RedisCacheModule } from './cache/redis-cache.module';
import { AuditModule } from './audit/audit.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SportsModule } from './sports/sports.module';
import { KobeModelsModule } from './kobe-models/kobe-models.module';
import { LicenseModule } from './license/license.module';
import { PrintModule } from './print/print.module';
import { AdminModule } from './admin/admin.module';
import { DevopsModule } from './devops/devops.module';
import { ErpModule } from './erp/erp.module';
import { AccountModule } from './account/account.module';
import { KobeSecurityModule } from './kobe-security/kobe-security.module';
import { HotelSecurityModule } from './hotel-security/hotel-security.module';
import { StudioMediaModule } from './studio-media/studio-media.module';
import { ShopStockModule } from './shop-stock/shop-stock.module';
import { DiscountApprovalModule } from './discount-approval/discount-approval.module';
import { SocialSchedulerModule } from './social-scheduler/social-scheduler.module';
import { AppStateModule } from './app-state/app-state.module';
import { AutomationModule } from './automation/automation.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync(databaseConfig),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
      { name: 'auth', ttl: 60_000, limit: 10 },
      // Tighter bucket for public lookup endpoints that expose
      // enumerable resources (e.g. /store-settings/check-slug).
      { name: 'public-lookup', ttl: 60_000, limit: 20 },
    ]),
    RedisCacheModule,
    AuditModule,
    WebhooksModule,
    VideoGenerationModule,
    AiModule,
    OcrModule,
    OrderFromImageModule,
    TranslationModule,
    ImageEditModule,
    SystemModule,
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
    AirCargoModule,
    ShopsModule,
    EodModule,
    PropertyModule,
    PosModule,
    NotificationsModule,
    FxModule,
    CustomerPortalModule,
    PushModule,
    KobeTokensModule,
    AppStateModule,
    AutomationModule,
    MzigoModule,
    WarehouseModule,
    DiscountsModule,
    PaymentsModule,
    CreditModule,
    HotelModule,
    HotelSecurityModule,
    CreatorsModule,
    StudioMediaModule,
    KobeSecurityModule,
    LicenseModule,
    PrintModule,
    AdminModule,
    ErpModule,
    SportsModule,
    KobeModelsModule,
    CompaniesModule,
    SubscriptionsModule,
    StoreSettingsModule,
    StoreModule,
    StoreRegistryModule,
    SocialSchedulerModule,
    DevopsModule,
    AccountModule,
    ShopStockModule,
    DiscountApprovalModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
    // Resolve store tenant from Host header for subdomain/custom-domain routing
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
