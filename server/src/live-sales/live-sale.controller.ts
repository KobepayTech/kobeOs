import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { LiveSaleService } from './live-sale.service';

class StartSessionDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() currency?: string;
}
class PinDto {
  @IsUUID() productId!: string;
  @IsString() @MaxLength(24) code!: string;
  @IsOptional() @IsNumber() @Min(0) livePrice?: number;
}
class IngestDto {
  @IsString() @MaxLength(1000) text!: string;
  @IsOptional() @IsString() @MaxLength(80) buyerHandle?: string;
  @IsOptional() @IsString() @MaxLength(40) buyerContact?: string;
  @IsOptional() @IsString() source?: string;
}
class ConvertDto {
  @IsOptional() @IsNumber() @Min(1) qty?: number;
  @IsOptional() @IsString() @MaxLength(40) buyerContact?: string;
  @IsOptional() @IsString() @MaxLength(24) code?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('live-sales')
export class LiveSaleController {
  constructor(private readonly svc: LiveSaleService) {}

  @Get() list(@CurrentUser('id') uid: string) { return this.svc.listSessions(uid); }
  @Post() start(@CurrentUser('id') uid: string, @Body() dto: StartSessionDto) { return this.svc.startSession(uid, dto); }
  @Get(':id') get(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.getSession(uid, id); }
  @Post(':id/end') end(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.endSession(uid, id); }
  @Post(':id/storefront') storefront(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: { show: boolean }) { return this.svc.setStorefront(uid, id, !!dto.show); }
  @Get(':id/stats') stats(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.stats(uid, id); }

  @Get(':id/pins') pins(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.listPins(uid, id); }
  @Post(':id/pins') pin(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: PinDto) { return this.svc.pinProduct(uid, id, dto); }
  @Delete(':id/pins/:pinId') unpin(@CurrentUser('id') uid: string, @Param('id') id: string, @Param('pinId') pinId: string) { return this.svc.unpin(uid, id, pinId); }

  @Get(':id/comments') comments(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.listComments(uid, id); }
  @Post(':id/comments') ingest(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: IngestDto) { return this.svc.ingestComment(uid, id, dto); }
  @Post('comments/:commentId/convert') convert(@CurrentUser('id') uid: string, @Param('commentId') commentId: string, @Body() dto: ConvertDto) { return this.svc.convert(uid, commentId, dto); }
  @Post('comments/:commentId/ignore') ignore(@CurrentUser('id') uid: string, @Param('commentId') commentId: string) { return this.svc.ignoreComment(uid, commentId); }
}

/**
 * Public bridge ingest. An external comment-forwarder (e.g. a TikTok-Live
 * bridge the operator runs themselves) POSTs comments here using the
 * session's ingestToken — no JWT. The token is the capability.
 */
@Public()
@Controller('live-sales/ingest')
export class LiveSaleIngestController {
  constructor(private readonly svc: LiveSaleService) {}

  @Post(':token')
  ingest(@Param('token') token: string, @Body() dto: IngestDto) {
    return this.svc.ingestByToken(token, dto);
  }
}

/** Public: the active shoppable live for a storefront slug (drives the
 *  "LIVE" banner on the online shop). */
@Public()
@Controller('live-sales/public')
export class LiveSalePublicController {
  constructor(private readonly svc: LiveSaleService) {}

  @Get(':slug')
  live(@Param('slug') slug: string) { return this.svc.publicLive(slug); }
}
