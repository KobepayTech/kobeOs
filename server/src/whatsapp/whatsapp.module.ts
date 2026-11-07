import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsAppContact, WhatsAppMessage, WhatsAppSettings } from './whatsapp.entity';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController, WhatsAppWebhookController } from './whatsapp.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsAppContact, WhatsAppMessage, WhatsAppSettings]),
    ConfigModule,
    // The assistant and its guardrails answer customers; Beem sends the reply.
    AiModule,
    NotificationsModule,
  ],
  providers: [WhatsAppService],
  controllers: [WhatsAppController, WhatsAppWebhookController],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
