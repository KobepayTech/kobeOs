import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BusinessBriefingService } from './business-briefing.service';
@Controller('brain')
@UseGuards(JwtAuthGuard)
export class BusinessFoundationsController {
  constructor(private readonly brain: BusinessBriefingService) {}
  @Get('snapshot') snapshot(@CurrentUser('id') id: string, @CurrentUser('role') role: string, @Query('timezone') timezone = 'UTC', @Query('ownerId') owner?: string) { return this.brain.snapshot(id, role, timezone, owner); }
  @Get('briefing') briefing(@CurrentUser('id') id: string, @CurrentUser('role') role: string, @Query('timezone') timezone = 'UTC') { return this.brain.briefing(id, role, timezone); }
}
