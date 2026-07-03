import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { HotelRoomReviewsService, HotelRoomSignalLinksService, HotelSecurityDashboardService } from './hotel-security.service';
import { RoomEntryService } from './room-entry.service';
import type { StaffBadgeRole } from './hotel-room-entry.entity';
import {
  CreateHotelRoomReviewDto,
  CreateHotelRoomSignalLinkDto,
  UpdateHotelRoomReviewDto,
  UpdateHotelRoomSignalLinkDto,
} from './dto/hotel-security.dto';

// Decorators required — the global whitelist:true ValidationPipe strips
// undecorated properties (badge scans / flag resolution would arrive empty).
class StaffBadgeScanDto {
  @IsString() staffId!: string;
  @IsString() staffName!: string;
  @IsString() staffRole!: StaffBadgeRole;
  @IsString() roomId!: string;
  @IsString() roomNumber!: string;
}

class ResolveFlagDto {
  @IsOptional() @IsString() notes?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('hotel-security')
export class HotelSecurityController {
  constructor(
    private readonly dashboard: HotelSecurityDashboardService,
    private readonly links: HotelRoomSignalLinksService,
    private readonly reviews: HotelRoomReviewsService,
    private readonly entries: RoomEntryService,
  ) {}

  @Get('summary') summary(@CurrentUser('id') uid: string) { return this.dashboard.summary(uid); }

  @Get('room-links') listLinks(@CurrentUser('id') uid: string) { return this.links.list(uid); }
  @Post('room-links') createLink(@CurrentUser('id') uid: string, @Body() dto: CreateHotelRoomSignalLinkDto) { return this.links.create(uid, dto); }
  @Patch('room-links/:id') updateLink(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateHotelRoomSignalLinkDto) { return this.links.update(uid, id, dto); }
  @Delete('room-links/:id') deleteLink(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.links.remove(uid, id); }

  @Get('room-reviews') listReviews(@CurrentUser('id') uid: string) { return this.reviews.list(uid); }
  @Post('room-reviews') createReview(@CurrentUser('id') uid: string, @Body() dto: CreateHotelRoomReviewDto) { return this.reviews.create(uid, dto); }
  @Patch('room-reviews/:id') updateReview(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateHotelRoomReviewDto) { return this.reviews.update(uid, id, dto); }
  @Delete('room-reviews/:id') deleteReview(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.reviews.remove(uid, id); }

  // ── Room-entry events (driven by RuView ingest cron) ────────────────────

  @Get('room-status') roomStatus(@CurrentUser('id') uid: string) { return this.entries.listRoomStatus(uid); }

  @Get('room-entries') recent(@CurrentUser('id') uid: string) { return this.entries.listRecentEntries(uid); }

  @Get('room-entries/flagged') flagged(@CurrentUser('id') uid: string) { return this.entries.listPolicyFlagged(uid); }

  @Get('room-occupancy-counts') counts(@CurrentUser('id') uid: string) { return this.entries.countRoomOccupancies(uid); }

  @Get('room-entries/:roomId') room(@CurrentUser('id') uid: string, @Param('roomId') roomId: string) {
    return this.entries.listRoomEntries(uid, roomId);
  }

  @Post('room-entries/:id/resolve')
  resolve(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: ResolveFlagDto) {
    return this.entries.resolvePolicyFlag(uid, id, dto.notes ?? '');
  }

  @Post('staff-badge-scan')
  scanBadge(@CurrentUser('id') uid: string, @Body() dto: StaffBadgeScanDto) {
    return this.entries.scanStaffBadge(uid, dto);
  }
}
