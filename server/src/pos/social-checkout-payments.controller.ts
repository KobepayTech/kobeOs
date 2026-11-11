import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { SocialCheckoutPaymentsService } from './social-checkout-payments.service';

@Controller('pos/social-checkout')
export class SocialCheckoutPaymentsController {
  constructor(private readonly payments: SocialCheckoutPaymentsService) {}

  @Public()
  @Post('palmpesa')
  @HttpCode(200)
  async notify(@Body() payload: Record<string, unknown>) {
    await this.payments.notify(payload);
    return { received: true };
  }
}
