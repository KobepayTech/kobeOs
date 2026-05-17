import {
  Body, Controller, Delete, Get, Param, Post, Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { StoreRegistryService } from './store-registry.service';
import { ClaimSubdomainDto, HeartbeatDto } from './dto/store-registry.dto';

@Controller('store-registry')
export class StoreRegistryController {
  constructor(private readonly svc: StoreRegistryService) {}

  /**
   * Check if a slug is available — public, no auth.
   * GET /api/store-registry/check/:slug
   */
  @Public()
  @Get('check/:slug')
  check(@Param('slug') slug: string) {
    return this.svc.checkAvailability(slug.toLowerCase());
  }

  /**
   * Claim a subdomain.
   * POST /api/store-registry/claim
   *
   * If serverIp is not provided in the body, we fall back to the
   * request's remote address (works when KobeOS calls this directly).
   */
  @UseGuards(JwtAuthGuard)
  @Post('claim')
  claim(
    @CurrentUser('id') ownerId: string,
    @Body() dto: ClaimSubdomainDto,
    @Req() req: Request,
  ) {
    // Auto-detect IP from request if not explicitly provided
    if (!dto.serverIp || dto.serverIp === 'auto') {
      const forwarded = req.headers['x-forwarded-for'];
      dto.serverIp = Array.isArray(forwarded)
        ? forwarded[0]
        : (forwarded?.split(',')[0] ?? req.socket.remoteAddress ?? '');
    }
    return this.svc.claim(ownerId, dto);
  }

  /**
   * Unpublish a store — removes the DNS record.
   * DELETE /api/store-registry/:slug
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':slug')
  unpublish(@CurrentUser('id') ownerId: string, @Param('slug') slug: string) {
    return this.svc.unpublish(ownerId, slug);
  }

  /**
   * Heartbeat — called every ~5 min by each KobeOS instance.
   * POST /api/store-registry/heartbeat
   */
  @UseGuards(JwtAuthGuard)
  @Post('heartbeat')
  heartbeat(@CurrentUser('id') ownerId: string, @Body() dto: HeartbeatDto) {
    return this.svc.heartbeat(ownerId, dto);
  }

  /**
   * List all registrations for the authenticated owner.
   * GET /api/store-registry
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser('id') ownerId: string) {
    return this.svc.listByOwner(ownerId);
  }
}
