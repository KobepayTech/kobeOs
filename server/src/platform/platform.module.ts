import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';
import { PLATFORM_ENTITIES } from './platform.entity';
import { PlatformController } from './platform.controller';
import { PlatformEventsService, PlatformNotificationService } from './platform.service';

@Module({
  imports: [TypeOrmModule.forFeature([...PLATFORM_ENTITIES]), NotificationsModule, PushModule],
  controllers: [PlatformController],
  providers: [PlatformEventsService, PlatformNotificationService],
  exports: [PlatformEventsService, PlatformNotificationService],
})
export class PlatformModule {}
