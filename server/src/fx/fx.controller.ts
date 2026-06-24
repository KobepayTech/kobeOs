import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FxRate, FxService } from './fx.service';

@UseGuards(JwtAuthGuard)
@Controller('fx')
export class FxController {
  constructor(private readonly svc: FxService) {}

  @Get('current')
  async current(@Query('from') from?: string, @Query('to') to?: string): Promise<FxRate> {
    if (!from || !to) throw new BadRequestException('from + to query params required');
    return this.svc.getRate(from, to);
  }
}
