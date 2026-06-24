import { BadRequestException, Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { CustomerPortalService, PortalDashboard } from './customer-portal.service';

/**
 * Public customer portal endpoints. No JwtAuthGuard — the portal uses
 * its own OTP-issued token (kind=customer-portal) verified manually
 * in /me/dashboard via the Authorization header.
 */
@Controller('me')
export class CustomerPortalController {
  constructor(private readonly svc: CustomerPortalService) {}

  @Post('request-otp')
  request(@Body() dto: { phone: string }) {
    if (!dto?.phone) throw new BadRequestException('phone is required');
    return this.svc.requestOtp(dto.phone);
  }

  @Post('verify-otp')
  verify(@Body() dto: { phone: string; code: string }) {
    if (!dto?.phone || !dto?.code) throw new BadRequestException('phone + code required');
    return this.svc.verifyOtp(dto.phone, dto.code);
  }

  @Get('dashboard')
  async dashboard(@Headers('authorization') authHeader?: string): Promise<PortalDashboard> {
    const token = (authHeader ?? '').replace(/^Bearer /, '').trim();
    if (!token) throw new UnauthorizedException('Missing token');
    const phone = await this.svc.verifyToken(token);
    return this.svc.dashboard(phone);
  }
}
