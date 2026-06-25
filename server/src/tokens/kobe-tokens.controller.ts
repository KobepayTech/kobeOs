import { BadRequestException, Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { KobeTokensService, PublicTokenView } from './kobe-tokens.service';

/**
 * Public Kobe Token endpoints.
 *
 *   POST   /api/tokens                 issue (auth optional — public
 *                                       /tuma page issues anonymously;
 *                                       KobePay operators issue authed)
 *   GET    /api/tokens/:code           lookup status (no PIN required)
 *   POST   /api/tokens/:code/redeem    redeem with { pin, paidByName }
 *   GET    /api/tokens/mine            authed — ledger of tokens this
 *                                       tenant issued or redeemed
 *
 * Anonymous issue keeps the standalone Tuma page working from any
 * device. Authed issue records the operator's tenant id on the token
 * for commission / ledger purposes.
 */
@Controller('tokens')
export class KobeTokensController {
  constructor(
    private readonly svc: KobeTokensService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Optional auth — reads Authorization header if present, returns
   *  the tenant id; returns null on any verification failure so the
   *  endpoint stays accessible to the anonymous /tuma page. */
  private async maybeOwner(authHeader?: string): Promise<string | null> {
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer /, '').trim();
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(
        token,
        { secret: this.config.getOrThrow<string>('JWT_SECRET') },
      );
      return payload.sub ?? null;
    } catch { return null; }
  }

  @Post()
  async issue(
    @Body() dto: {
      amount: number; currency?: string;
      senderName: string; senderPhone?: string;
      receiverName: string; receiverPhone?: string;
      purpose?: string; agent?: string;
      issuedByName?: string;
      expiresInHours?: number;
    },
    @Headers('authorization') authHeader?: string,
  ): Promise<{ token: PublicTokenView; pin: string }> {
    const issuedOwnerId = await this.maybeOwner(authHeader);
    return this.svc.issue({ ...dto, issuedOwnerId });
  }

  @Get(':code')
  lookup(@Param('code') code: string): Promise<PublicTokenView> {
    return this.svc.lookup(code);
  }

  @Post(':code/redeem')
  async redeem(
    @Param('code') code: string,
    @Body() dto: { pin: string; paidByName: string },
    @Headers('authorization') authHeader?: string,
  ): Promise<PublicTokenView> {
    if (!dto?.pin) throw new BadRequestException('pin is required');
    if (!dto?.paidByName?.trim()) throw new BadRequestException('paidByName is required');
    const paidOwnerId = await this.maybeOwner(authHeader);
    return this.svc.redeem(code, { pin: dto.pin, paidByName: dto.paidByName, paidOwnerId });
  }
}

/** Authed ledger — operator-side view of tokens their tenant
 *  touched. Kept on a separate route so the JwtAuthGuard doesn't
 *  block the anonymous endpoints above. */
@UseGuards(JwtAuthGuard)
@Controller('tokens-mine')
export class KobeTokensLedgerController {
  constructor(private readonly svc: KobeTokensService) {}

  @Get()
  mine(@CurrentUser('id') uid: string) {
    return this.svc.listForOwner(uid);
  }
}
