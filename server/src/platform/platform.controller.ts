import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformEventsService, PlatformNotificationService } from './platform.service';

@UseGuards(JwtAuthGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly events: PlatformEventsService, private readonly notifications: PlatformNotificationService) {}
  @Get('events') listEvents(@CurrentUser('id') uid: string, @Query('limit') limit?: string) { return this.events.list(uid, Number(limit) || 200); }
  @Get('notifications') listNotifications(@CurrentUser('id') uid: string) { return this.notifications.list(uid); }
}
