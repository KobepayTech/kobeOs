import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenseService } from './license.service';
import { InitiateLicenseDto } from './dto/initiate-license.dto';

@Controller('license')
export class LicenseController {
  constructor(private readonly svc: LicenseService) {}

  /**
   * Initiate a USSD push payment for an OS license.
   * Returns { transactionId, orderId, amount, plan } — client polls /status/:txId.
   */
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  initiate(@Request() req: { user: { id: string } }, @Body() dto: InitiateLicenseDto) {
    return this.svc.initiate(req.user.id, dto);
  }

  /**
   * Poll payment + activation status.
   * Returns { status } or { status: 'active', token, expiresAt } when confirmed.
   */
  @UseGuards(JwtAuthGuard)
  @Get('status/:transactionId')
  status(
    @Request() req: { user: { id: string } },
    @Param('transactionId') transactionId: string,
  ) {
    return this.svc.getPendingStatus(req.user.id, transactionId);
  }

  /**
   * Return the current active license token for the authenticated user.
   * Used on OS boot to refresh the stored token without re-paying.
   */
  @UseGuards(JwtAuthGuard)
  @Get('active')
  active(@Request() req: { user: { id: string } }) {
    return this.svc.getActiveLicense(req.user.id);
  }

  /**
   * Issue a free 7-day trial license (idempotent — one trial per user).
   * Called automatically on first OS boot after signup; subsequent calls
   * return either the same active trial or {status:'expired'} so the
   * client can show the paywall and route the user into /initiate.
   */
  @UseGuards(JwtAuthGuard)
  @Post('start-trial')
  startTrial(@Request() req: { user: { id: string } }) {
    return this.svc.startTrial(req.user.id);
  }

  /**
   * Renew the current plan — initiates a new USSD push for the same tier.
   */
  @UseGuards(JwtAuthGuard)
  @Post('renew')
  renew(
    @Request() req: { user: { id: string } },
    @Body('msisdn') msisdn: string,
  ) {
    return this.svc.renew(req.user.id, msisdn);
  }
}
