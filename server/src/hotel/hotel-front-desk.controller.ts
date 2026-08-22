import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { HotelFrontDeskService } from './hotel-front-desk.service';

class CreateFrontDeskReservationDto {
  @IsUUID() roomId!: string;
  @IsString() @MaxLength(120) guestName!: string;
  @IsString() @MaxLength(40) guestPhone!: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @MaxLength(80) guestNationality?: string;
  @IsOptional() @IsString() @MaxLength(40) guestIdType?: string;
  @IsOptional() @IsString() @MaxLength(120) guestIdNumber?: string;
  @IsString() checkIn!: string;
  @IsString() checkOut!: string;
  @IsOptional() @IsInt() @Min(1) guestCount?: number;
  @IsOptional() @IsNumber() @Min(0) totalAmount?: number;
}

class RoomStatusDto {
  @IsEnum(['available', 'cleaning', 'maintenance']) status!: 'available' | 'cleaning' | 'maintenance';
}

class RecordHotelPaymentDto {
  @IsNumber() @Min(0.01) amount!: number;
  @IsEnum(['CASH', 'MOBILE_MONEY', 'CARD', 'BANK']) method!: 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK';
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('hotel/front-desk')
export class HotelFrontDeskController {
  constructor(private readonly frontDesk: HotelFrontDeskService) {}

  @Post('reservations')
  createReservation(@CurrentUser('id') uid: string, @Body() dto: CreateFrontDeskReservationDto) {
    return this.frontDesk.createReservation(uid, dto);
  }

  @Post('bookings/:id/check-in')
  checkIn(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.frontDesk.checkIn(uid, id);
  }

  @Post('bookings/:id/check-out')
  checkOut(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.frontDesk.checkOut(uid, id);
  }

  @Post('bookings/:id/cancel')
  cancel(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.frontDesk.cancel(uid, id);
  }

  @Get('bookings/:id/folio')
  folio(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.frontDesk.folio(uid, id);
  }

  @Post('bookings/:id/payments')
  recordPayment(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: RecordHotelPaymentDto) {
    return this.frontDesk.recordPayment(uid, id, dto);
  }

  @Patch('rooms/:id/status')
  setRoomStatus(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: RoomStatusDto) {
    return this.frontDesk.setRoomStatus(uid, id, dto.status);
  }
}
