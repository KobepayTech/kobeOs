import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { timingSafeEqual } from 'crypto';
import { Public } from '../common/public.decorator';
import { DepositEngineService } from './deposit-engine.service';

class MpesaSmsDto {
  @IsString() @MaxLength(2000) message!: string;
  @IsOptional() @IsString() @MaxLength(120) device_id?: string;
  @IsOptional() @IsString() @MaxLength(200) gateway_key?: string;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Public webhook for the M-Pesa SMS bridge.
 *
 * An iPhone Shortcuts automation forwards each incoming M-Pesa SMS here as JSON.
 * Auth is a shared gateway key (header `x-gateway-key` or body `gateway_key`)
 * checked against KP_MPESA_GATEWAY_KEY. The owner to credit is resolved from
 * KP_MPESA_OWNER_ID (single-tenant deployments); a device→owner registry can
 * replace this for multi-school hosting.
 *
 * Idempotency lives in the deposit engine (unique bank transaction id), so a
 * re-forwarded SMS is safely ignored.
 */
@Public()
@Controller('mpesa')
export class MpesaController {
  constructor(private readonly deposits: DepositEngineService) {}

  @Post('sms')
  async sms(@Body() dto: MpesaSmsDto, @Headers('x-gateway-key') headerKey?: string) {
    const expected = process.env.KP_MPESA_GATEWAY_KEY;
    const ownerId = process.env.KP_MPESA_OWNER_ID;
    if (!expected || !ownerId) throw new ForbiddenException('M-Pesa bridge is not configured');
    const provided = headerKey || dto.gateway_key || '';
    if (!safeEqual(provided, expected)) throw new ForbiddenException('Invalid gateway key');

    const result = await this.deposits.ingestSms(ownerId, dto.message);
    // Always 200 so the phone doesn't retry forever on non-payment SMS; the
    // status field tells the operator what happened.
    return result;
  }
}
