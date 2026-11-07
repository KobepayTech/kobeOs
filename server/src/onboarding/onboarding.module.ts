import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { AppEntitlement } from '../app-marketplace/app-entitlement.entity';
import { UserOnboarding } from './onboarding.entity';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { SetupProvisioningService } from './setup-provisioning.service';
import { AppMarketplaceModule } from '../app-marketplace/app-marketplace.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOnboarding, User, StoreSettings, AppEntitlement]),
    // Bundles are entitled through the existing marketplace gate, and
    // automations are the existing scheduled agents: neither is reimplemented.
    AppMarketplaceModule,
    AiModule,
  ],
  providers: [OnboardingService, SetupProvisioningService],
  controllers: [OnboardingController],
  exports: [OnboardingService, SetupProvisioningService],
})
export class OnboardingModule {}
