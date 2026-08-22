import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MobileSubscription } from './mobile-subscription.entity';
import { MobileSubscriptionService } from './mobile-subscription.service';
import { MobileSubscriptionController } from './mobile-subscription.controller';
import { CreatorsModule } from '../creators/creators.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MobileSubscription]),
    CreatorsModule, // provides PalmPesaService
  ],
  providers: [MobileSubscriptionService],
  controllers: [MobileSubscriptionController],
  exports: [MobileSubscriptionService],
})
export class MobileSubscriptionModule {}
