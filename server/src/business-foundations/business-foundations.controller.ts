import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BusinessBriefingService } from './business-briefing.service';
@Controller('brain')
@UseGuards(JwtAuthGuard)
export class BusinessFoundationsController {
  constructor(private readonly brain: BusinessBriefingService) {}
  @Get('conversations') conversations(@CurrentUser('id') id: string, @CurrentUser('role') role: string) { return this.brain.conversations(id, role); }
  @Get('physical-state') physicalState(@CurrentUser('id') id: string, @CurrentUser('role') role: string, @Query('ownerId') owner?: string) { return this.brain.physicalState(id, role, owner); }
  @Get('snapshot') snapshot(@CurrentUser('id') id: string, @CurrentUser('role') role: string, @Query('timezone') timezone = 'UTC', @Query('ownerId') owner?: string) { return this.brain.snapshot(id, role, timezone, owner); }
  @Get('briefing') briefing(@CurrentUser('id') id: string, @CurrentUser('role') role: string, @Query('timezone') timezone = 'UTC', @Query('ownerId') owner?: string) { return this.brain.briefing(id, role, timezone, owner); }
}
