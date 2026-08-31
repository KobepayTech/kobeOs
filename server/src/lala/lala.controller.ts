import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { LalaService } from './lala.service';

@UseGuards(JwtAuthGuard)
@Controller('lala')
export class LalaController {
  constructor(private readonly lala: LalaService) {}
  @Get('hotels') hotels(@CurrentUser('id') uid: string) { return this.lala.listMine(uid); }
  @Patch('hotels/:hotelId/profile') profile(@CurrentUser('id') uid: string, @Param('hotelId') hotelId: string, @Body() body: Record<string, unknown>) { return this.lala.saveProfile(uid, hotelId, body); }
  @Post('hotels/:hotelId/room-types') roomType(@CurrentUser('id') uid: string, @Param('hotelId') hotelId: string, @Body() body: { name: string } & Record<string, unknown>) { return this.lala.saveRoomType(uid, hotelId, body); }
  @Post('hotels/:hotelId/inventory') inventory(@CurrentUser('id') uid: string, @Param('hotelId') hotelId: string, @Body() body: { roomTypeId: string; from: string; to: string; availableRooms: number; rate: number; currency?: string }) { return this.lala.setInventory(uid, hotelId, body); }
  @Patch('hotels/:hotelId/loyalty') loyalty(@CurrentUser('id') uid: string, @Param('hotelId') hotelId: string, @Body() body: Record<string, unknown>) { return this.lala.saveLoyaltyProgram(uid, hotelId, body); }
  @Post('stays/:bookingId/complete') complete(@CurrentUser('id') uid: string, @Param('bookingId') bookingId: string) { return this.lala.completeStay(uid, bookingId); }
  @Get('reverse-requests') requests(@CurrentUser('id') uid: string) { return this.lala.openRequests(uid); }
  @Get('group-requests') groups(@CurrentUser('id') uid: string) { return this.lala.groupRequests(uid); }
  @Post('reverse-requests/:id/offers') offer(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() body: { hotelId: string; roomId: string; totalPrice: number; currency?: string; message?: string; expiresAt: string }) { return this.lala.offer(uid, id, body); }
}

@Public()
@Controller('lala-public')
export class LalaPublicController {
  constructor(private readonly lala: LalaService) {}
  @Get('health') health() { return this.lala.publicHealth(); }
  @Get('search') search(@Query() query: Record<string, string>) { return this.lala.search(query); }
  @Post('passports') passport(@Body() body: { phone: string; name: string; email?: string; nationality?: string; preferences?: Record<string, unknown>; privacy?: Record<string, boolean> }) { return this.lala.passport(body); }
  @Get('passports/:token') passportByToken(@Param('token') token: string) { return this.lala.passportByToken(token); }
  @Post('bookings') book(@Body() body: { hotelId: string; roomId: string; passportToken: string; checkIn: string; checkOut: string; guests?: number }) { return this.lala.book(body); }
  @Post('reviews') review(@Body() body: { passportToken: string; verifiedStayId: string; rating: number; comment?: string }) { return this.lala.review(body); }
  @Post('reverse-requests') request(@Body() body: { passportToken: string; destination: string; checkIn: string; checkOut: string; guests?: number; budget?: number; currency?: string }) { return this.lala.createReverseRequest(body); }
  @Get('reverse-requests/:id/offers') offers(@Param('id') id: string, @Query('passportToken') token: string) { return this.lala.requestOffers(token, id); }
  @Post('reverse-requests/:id/offers/:offerId/accept') acceptOffer(@Param('id') id: string, @Param('offerId') offerId: string, @Body() body: { passportToken: string }) { return this.lala.acceptOffer(body.passportToken, id, offerId); }
  @Post('corporate-accounts') corporate(@Body() body: { name: string; contactName?: string; phone?: string; email?: string; type?: 'CORPORATE' | 'AGENT' }) { return this.lala.createCorporateAccount(body); }
  @Post('group-requests') group(@Body() body: { corporateAccountId?: string; destination: string; checkIn: string; checkOut: string; rooms: number; guests: number }) { return this.lala.createGroupRequest(body); }
}
