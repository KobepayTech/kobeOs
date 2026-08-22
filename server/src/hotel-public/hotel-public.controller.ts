import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';
import { HotelPublicService } from './hotel-public.service';

class PublicBookBody {
  @IsOptional() @IsString() @MaxLength(60) roomId?: string;
  @IsOptional() @IsString() @MaxLength(60) roomType?: string;
  @IsString() @MaxLength(120) guestName!: string;
  @IsString() @MaxLength(40) guestPhone!: string;
  @IsString() @MaxLength(10) checkIn!: string;
  @IsString() @MaxLength(10) checkOut!: string;
  @IsOptional() @IsInt() @Min(1) guests?: number;
}

@ApiTags('Hotel / Public booking')
@Public()
@Controller('hotel/public')
export class HotelPublicController {
  constructor(private readonly svc: HotelPublicService) {}

  @Get(':slug/rooms')
  @ApiOperation({ summary: 'Public: list a hotel\'s rooms + rates by slug' })
  rooms(@Param('slug') slug: string) { return this.svc.listRooms(slug); }

  @Post(':slug/book')
  @ApiOperation({ summary: 'Public: book a room (creates a PENDING booking)' })
  book(@Param('slug') slug: string, @Body() dto: PublicBookBody) { return this.svc.book(slug, dto); }
}
