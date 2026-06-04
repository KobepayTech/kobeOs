import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreditService } from './credit.service';
import { RecordPaymentDto, UpsertCreditProfileDto } from './dto/credit.dto';

@UseGuards(JwtAuthGuard)
@Controller('credit')
export class CreditController {
  constructor(private readonly svc: CreditService) {}

  @Get('profiles')
  listProfiles(@CurrentUser('id') uid: string) { return this.svc.listProfiles(uid); }

  @Post('profiles')
  upsertProfile(@CurrentUser('id') uid: string, @Body() dto: UpsertCreditProfileDto) {
    return this.svc.upsert(uid, dto);
  }

  @Get('profiles/by-phone/:phone')
  getByPhone(@CurrentUser('id') uid: string, @Param('phone') phone: string) {
    return this.svc.getByPhone(uid, phone);
  }

  @Get('receivables')
  listReceivables(@CurrentUser('id') uid: string) { return this.svc.listReceivables(uid); }

  @Patch('receivables/:id/pay')
  recordPayment(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.svc.recordPayment(uid, id, dto);
  }
}
