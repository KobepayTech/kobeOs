import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BookingsService, GuestsService, RoomsService } from './hotel.service';
import {
  CreateBookingDto, CreateGuestDto, CreateRoomDto,
  UpdateBookingDto, UpdateGuestDto, UpdateRoomDto,
} from './dto/hotel.dto';

@UseGuards(JwtAuthGuard)
@Controller('hotel')
export class HotelController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly guests: GuestsService,
    private readonly bookings: BookingsService,
  ) {}

  @Get('rooms') listRooms(@CurrentUser('id') uid: string) { return this.rooms.list(uid); }
  @Post('rooms') createRoom(@CurrentUser('id') uid: string, @Body() dto: CreateRoomDto) { return this.rooms.create(uid, dto); }
  @Patch('rooms/:id') updateRoom(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateRoomDto) { return this.rooms.update(uid, id, dto); }
  @Delete('rooms/:id') removeRoom(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.rooms.remove(uid, id); }

  @Get('guests') listGuests(@CurrentUser('id') uid: string) { return this.guests.list(uid); }
  @Post('guests') createGuest(@CurrentUser('id') uid: string, @Body() dto: CreateGuestDto) { return this.guests.create(uid, dto); }
  @Patch('guests/:id') updateGuest(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateGuestDto) { return this.guests.update(uid, id, dto); }
  @Delete('guests/:id') removeGuest(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.guests.remove(uid, id); }

  @Get('bookings') listBookings(@CurrentUser('id') uid: string) { return this.bookings.list(uid); }
  @Post('bookings') createBooking(@CurrentUser('id') uid: string, @Body() dto: CreateBookingDto) { return this.bookings.create(uid, dto); }
  @Patch('bookings/:id') updateBooking(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateBookingDto) { return this.bookings.update(uid, id, dto); }
  @Delete('bookings/:id') removeBooking(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.bookings.remove(uid, id); }
}
