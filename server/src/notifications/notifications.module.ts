import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BeemModule } from './beem.module';
import { NotificationsService } from './notifications.service';
import { CampaignsService } from './campaigns.service';
import { NotificationsController } from './notifications.controller';
import { OutboundCampaign, OutboundMessage } from './outbound.entity';
import { PosOrder } from '../pos/pos.entity';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboundCampaign, OutboundMessage, PosOrder]),
    PushModule,
    BeemModule,
  ],
  providers: [NotificationsService, CampaignsService],
  controllers: [NotificationsController],
  exports: [NotificationsService, BeemModule],
})
export class NotificationsModule {}
