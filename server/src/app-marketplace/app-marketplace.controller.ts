import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AppMarketplaceService } from './app-marketplace.service';
import { ModuleEntitlementsService } from './module-entitlements.service';
import { InstallBundlesDto } from './dto/app-marketplace.dto';
import { CapturePayPalDto, PalmPesaAppPaymentDto } from './dto/app-marketplace.dto';

@Controller('app-marketplace')
export class AppMarketplaceController {
  constructor(
    private readonly service: AppMarketplaceService,
    private readonly modules: ModuleEntitlementsService,
  ) {}

  // ── Bundles and product modules ────────────────────────────────────────────
  // A bundle is what a customer picks; a product module is what is entitled.
  // Both resolve to the same per-app gate below, so trials, payments and
  // renewal are unchanged.

  /** Module-level access for this user, for launcher expansion. */
  @Get('modules')
  listModules(@CurrentUser('id') userId: string) {
    return this.modules.listModules(userId);
  }

  /** Claim one product module. Idempotent. */
  @Post('modules/:moduleId/install')
  installModule(@CurrentUser('id') userId: string, @Param('moduleId') moduleId: string) {
    return this.modules.installModule(userId, moduleId);
  }

  /** Claim every module a bundle selection needs, the overlap claimed once. */
  @Post('bundles/install')
  installBundles(@CurrentUser('id') userId: string, @Body() dto: InstallBundlesDto) {
    return this.modules.installBundles(userId, dto.bundleIds);
  }

  @Get('apps')
  list(@CurrentUser('id') userId: string) {
    return this.service.list(userId);
  }

  @Post('apps/:appId/install')
  install(@CurrentUser('id') userId: string, @Param('appId') appId: string) {
    return this.service.install(userId, appId);
  }

  @Post('apps/:appId/palmpesa')
  palmPesa(
    @CurrentUser('id') userId: string,
    @Param('appId') appId: string,
    @Body() dto: PalmPesaAppPaymentDto,
  ) {
    return this.service.initiatePalmPesa(userId, appId, dto.msisdn);
  }

  @Post('apps/:appId/paypal')
  paypal(@CurrentUser('id') userId: string, @Param('appId') appId: string) {
    return this.service.initiatePayPal(userId, appId);
  }

  @Post('apps/:appId/paypal/capture')
  capturePayPal(
    @CurrentUser('id') userId: string,
    @Param('appId') appId: string,
    @Body() dto: CapturePayPalDto,
  ) {
    return this.service.capturePayPal(userId, appId, dto.orderId);
  }

  @Get('payments/:transactionId')
  payment(
    @CurrentUser('id') userId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.service.paymentStatus(userId, transactionId);
  }
}
