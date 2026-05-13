import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from './webhook.entity';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent])],
  controllers: [WebhookController],
  providers: [WebhookGuard],
})
export class WebhooksModule {}
