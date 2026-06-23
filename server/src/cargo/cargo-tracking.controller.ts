import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CargoTrackingService, PublicTrackResult } from './cargo-tracking.service';

/**
 * Public tracking lookup — auth-free, called by the /track/{ref}
 * page. Returns a sanitised view (no PII) so it's safe to share
 * the URL with customers over WhatsApp.
 */
@Controller('track')
export class CargoPublicTrackingController {
  constructor(private readonly svc: CargoTrackingService) {}

  @Get(':reference')
  lookup(@Param('reference') reference: string): Promise<PublicTrackResult> {
    return this.svc.lookup(reference);
  }
}

/**
 * Operator-facing pre-alert endpoints. Customer-side cargo accounts
 * don't exist yet, so the operator registers pre-alerts on behalf of
 * customers (or a phone-side form does, with the operator's JWT).
 */
@UseGuards(JwtAuthGuard)
@Controller('cargo/pre-alerts')
export class CargoPreAlertsController {
  constructor(private readonly svc: CargoTrackingService) {}

  @Post()
  create(
    @CurrentUser('id') uid: string,
    @Body() dto: {
      customerId?: string;
      externalTracking: string;
      senderName?: string;
      senderPhone?: string;
      ownerName: string;
      ownerPhone: string;
      destination: string;
      description?: string;
      weight?: number;
      packageCount?: number;
    },
  ) {
    return this.svc.createPreAlert(uid, dto);
  }

  @Post('receive/:tracking')
  receive(
    @CurrentUser('id') uid: string,
    @Param('tracking') tracking: string,
    @Body() dto: { weight?: number; packageCount?: number },
  ) {
    return this.svc.receivePreAlert(uid, tracking, dto);
  }
}
