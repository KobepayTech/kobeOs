import { Module } from '@nestjs/common';
import { BeemService } from './beem.service';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [BeemService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
