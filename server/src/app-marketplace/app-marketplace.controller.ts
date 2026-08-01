import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AppMarketplaceService } from './app-marketplace.service';
import { CapturePayPalDto, PalmPesaAppPaymentDto } from './dto/app-marketplace.dto';

@Controller('app-marketplace')
export class AppMarketplaceController {
  constructor(private readonly service: AppMarketplaceService) {}

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
