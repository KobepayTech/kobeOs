import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { AppEntitlement } from '../app-marketplace/app-entitlement.entity';
import { UserOnboarding } from './onboarding.entity';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserOnboarding, User, StoreSettings, AppEntitlement])],
  providers: [OnboardingService],
  controllers: [OnboardingController],
  exports: [OnboardingService],
})
export class OnboardingModule {}
