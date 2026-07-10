import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from './webhook.entity';
import { HotelBooking, HotelRoom } from '../hotel/hotel.entity';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent, HotelBooking, HotelRoom])],
  controllers: [WebhookController],
  providers: [WebhookGuard, WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly webhookService: WebhookService,
  ) {}

  async onModuleInit() {
    // Wire services after all modules are initialised to avoid circular imports.
    try {
      const { CreatorSubscriptionService } = await import(
        '../creators/creator-subscription.service'
      );
      const svc = this.moduleRef.get(CreatorSubscriptionService, { strict: false });
      if (svc) this.webhookService.setCreatorSubscriptionService(svc);
    } catch {
      // CreatorsModule not loaded — skip
    }

    try {
      const { LicenseService } = await import('../license/license.service');
      const svc = this.moduleRef.get(LicenseService, { strict: false });
      if (svc) this.webhookService.setLicenseService(svc);
    } catch {
      // LicenseModule not loaded — skip
    }
  }
}
