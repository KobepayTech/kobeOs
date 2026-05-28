import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { HotelRoomReviewsService, HotelRoomSignalLinksService, HotelSecurityDashboardService } from './hotel-security.service';
import {
  CreateHotelRoomReviewDto,
  CreateHotelRoomSignalLinkDto,
  UpdateHotelRoomReviewDto,
  UpdateHotelRoomSignalLinkDto,
} from './dto/hotel-security.dto';

@UseGuards(JwtAuthGuard)
@Controller('hotel-security')
export class HotelSecurityController {
  constructor(
    private readonly dashboard: HotelSecurityDashboardService,
    private readonly links: HotelRoomSignalLinksService,
    private readonly reviews: HotelRoomReviewsService,
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
}
