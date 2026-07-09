import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppState } from '../app-state/app-state.entity';
import { RentCharge, Tenant } from '../property/property.entity';
import { Shop } from '../shops/shop.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppState, Tenant, RentCharge, Shop]),
    NotificationsModule,
    AiModule,
  ],
  providers: [AutomationService],
  controllers: [AutomationController],
})
export class AutomationModule {}
