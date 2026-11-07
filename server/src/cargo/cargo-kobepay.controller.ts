import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CargoKobePayService, PayCargoFreightDto } from './cargo-kobepay.service';

@UseGuards(JwtAuthGuard)
@Controller('cargo/kobepay')
export class CargoKobePayController {
  constructor(private readonly payments: CargoKobePayService) {}
  @Get('accounts') accounts(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin?: string) { return this.payments.accounts(uid, pin); }
  @Post('freight-payments') pay(@CurrentUser('id') uid: string, @Body() dto: PayCargoFreightDto, @Headers('x-kobepay-pin') pin?: string) { return this.payments.pay(uid, dto, pin); }
}
