import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { PosProduct } from '../pos/pos.entity';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { TenantMiddleware } from '../store-settings/tenant.middleware';
import { PosModule } from '../pos/pos.module';

@Module({
  imports: [TypeOrmModule.forFeature([StoreSettings, PosProduct]), PosModule],
  providers: [StoreService],
  controllers: [StoreController],
  exports: [StoreService],
})
export class StoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant resolution to all routes so req.tenant is always available
    consumer.apply(TenantMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
