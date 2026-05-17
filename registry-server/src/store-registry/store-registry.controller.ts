import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StoreRegistryService } from './store-registry.service';
import { ClaimDto, HeartbeatDto } from './dto/registry.dto';
import { RegistryUser } from '../auth/user.entity';

@Controller('store-registry')
export class StoreRegistryController {
  constructor(private readonly svc: StoreRegistryService) {}

  /** Public — check slug availability */
  @Get('check/:slug')
  check(@Param('slug') slug: string) {
    return this.svc.check(slug.toLowerCase());
  }

  /** Public — list all active stores (used by DNS/proxy tooling) */
  @Get('all')
  listAll() {
    return this.svc.listAll();
  }

  /** Claim a subdomain — auto-detects IP from request if not provided */
  @UseGuards(JwtAuthGuard)
  @Post('claim')
  claim(
    @CurrentUser('id') ownerId: string,
    @Body() dto: ClaimDto,
    @Req() req: Request,
  ) {
    if (!dto.serverIp || dto.serverIp === 'auto') {
      const fwd = req.headers['x-forwarded-for'];
      dto.serverIp = Array.isArray(fwd)
        ? fwd[0]
        : (fwd?.split(',')[0] ?? req.socket.remoteAddress ?? '');
    }
    return this.svc.claim(ownerId, dto);
  }

  /** Unpublish — removes DNS record */
  @UseGuards(JwtAuthGuard)
  @Delete(':slug')
  unpublish(@CurrentUser('id') ownerId: string, @Param('slug') slug: string) {
    return this.svc.unpublish(ownerId, slug);
  }

  /** Heartbeat — keeps store marked active */
  @UseGuards(JwtAuthGuard)
  @Post('heartbeat')
  heartbeat(@CurrentUser('id') ownerId: string, @Body() dto: HeartbeatDto) {
    return this.svc.heartbeat(ownerId, dto);
  }

  /** List registrations for the authenticated owner */
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: RegistryUser) {
    return this.svc.list(user.id);
  }
}
