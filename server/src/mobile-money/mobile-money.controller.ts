import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { MobileMoneyService } from './mobile-money.service';
import type { InboundPayment } from './mobile-money.entity';

class SmsDto {
  @IsString() @MaxLength(2000) message!: string;
  @IsOptional() @IsString() @MaxLength(120) device_id?: string;
  @IsOptional() @IsString() @MaxLength(200) gateway_key?: string;
}
class RegisterDeviceDto {
  @IsString() @MaxLength(120) deviceId!: string;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsString() @MaxLength(60) purpose?: string;
  @IsOptional() @IsString() @MaxLength(200) gatewayKey?: string;
}

/**
 * Public SMS bridge. The iPhone Shortcuts automation POSTs each forwarded SMS
 * here as JSON: { device_id, message, gateway_key }. Kept at /api/mpesa/sms for
 * the existing automation; /api/sms/inbound is an alias.
 */
@Public()
@Controller()
export class MobileMoneyPublicController {
  constructor(private readonly svc: MobileMoneyService) {}

  @Post(['mpesa/sms', 'sms/inbound'])
  async sms(@Body() dto: SmsDto, @Headers('x-gateway-key') headerKey?: string) {
    return this.svc.ingest({
      deviceId: dto.device_id,
      gatewayKey: headerKey || dto.gateway_key || '',
      message: dto.message,
    });
  }
}

/** Authenticated management: register forwarder devices and read the inbox. */
@UseGuards(JwtAuthGuard)
@Controller('mobile-money')
export class MobileMoneyController {
  constructor(private readonly svc: MobileMoneyService) {}

  @Get('devices') devices(@CurrentUser('id') uid: string) { return this.svc.listDevices(uid); }
  @Post('devices') register(@CurrentUser('id') uid: string, @Body() dto: RegisterDeviceDto) { return this.svc.registerDevice(uid, dto); }
  @Get('inbound') inbound(@CurrentUser('id') uid: string, @Query('status') status?: InboundPayment['status']) { return this.svc.listInbound(uid, status); }
}
