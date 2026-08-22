import {
  Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Post, Req,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { StoreRegistryService } from './store-registry.service';
import { ClaimSubdomainDto, HeartbeatDto } from './dto/store-registry.dto';

// Body for central tunnel provisioning. Decorated so the whitelist:true
// ValidationPipe keeps the fields (see the shops/eod DTO fix).
class ProvisionTunnelDto {
  @IsString() @MaxLength(120) ownerId!: string;
  @IsOptional() @IsString() @MaxLength(120) storeName?: string;
  @IsOptional() @IsString() @MaxLength(63) slug?: string;
  @IsOptional() @IsInt() @Min(1) localPort?: number;
}

@Controller('store-registry')
export class StoreRegistryController {
  constructor(
    private readonly svc: StoreRegistryService,
    private readonly config: ConfigService,
  ) {}

  /**
   * CENTRAL token-minting endpoint. A shop installer calls this with the
   * shared provisioning secret to receive its subdomain + cloudflared run
   * token — so CF_API_TOKEN stays on the central host and never ships in the
   * installer. Disabled unless KOBEOS_PROVISIONING_SECRET is set on the host.
   * POST /api/store-registry/provision-tunnel   (header: x-provisioning-secret)
   */
  @Public()
  @Post('provision-tunnel')
  provisionTunnel(
    @Body() dto: ProvisionTunnelDto,
    @Headers('x-provisioning-secret') secret?: string,
  ) {
    const expected = this.config.get<string>('KOBEOS_PROVISIONING_SECRET');
    if (!expected) {
      throw new ForbiddenException('Central provisioning is disabled (KOBEOS_PROVISIONING_SECRET not set on this host).');
    }
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid provisioning secret.');
    }
    return this.svc.provisionTunnel(dto);
  }

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
