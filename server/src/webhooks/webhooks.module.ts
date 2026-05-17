import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from './webhook.entity';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent])],
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
    // Wire CreatorSubscriptionService after all modules are initialised
    // to avoid a circular import between WebhooksModule ↔ CreatorsModule
    try {
      const { CreatorSubscriptionService } = await import(
        '../creators/creator-subscription.service'
      );
      const svc = this.moduleRef.get(CreatorSubscriptionService, { strict: false });
      if (svc) this.webhookService.setCreatorSubscriptionService(svc);
    } catch {
      // CreatorsModule not loaded — skip
    }
  }
}
