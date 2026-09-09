import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BroadcastService } from './broadcast.service';
class DestinationDto {
  @IsString() @MaxLength(500) serverUrl!: string;
  @IsString() @MaxLength(2048) streamKey!: string;
}
class ChunkDto {
  @IsInt() @Min(0) sequence!: number;
  @IsString() @MaxLength(1_400_000) data!: string;
}
@UseGuards(JwtAuthGuard)
@Controller('live-sales/:id/broadcast')
export class BroadcastController {
  constructor(private readonly broadcast: BroadcastService) {}
  @Get() status(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.broadcast.status(uid, id); }
  @Post('start') start(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: DestinationDto) { return this.broadcast.start(uid, id, dto.serverUrl, dto.streamKey); }
  @Throttle({ default: { limit: 120, ttl: 60_000 }, auth: { limit: 120, ttl: 60_000 }, 'public-lookup': { limit: 120, ttl: 60_000 } })
  @Post('chunk') chunk(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: ChunkDto) { return this.broadcast.chunk(uid, id, dto.sequence, dto.data); }
  @Post('stop') stop(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.broadcast.stop(uid, id); }
}
