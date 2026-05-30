import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ErpService } from './erp.service';
import { JournalService } from './journal.service';

@UseGuards(JwtAuthGuard)
@Controller('erp')
export class ErpController {
  constructor(
    private readonly svc: ErpService,
    private readonly journal: JournalService,
  ) {}

  @Get('dashboard')  dashboard(@CurrentUser('id') uid: string) { return this.svc.getDashboard(uid); }
  @Get('accounting') accounting(@CurrentUser('id') uid: string) { return this.svc.getAccounting(uid); }
  @Get('reports')    reports(@CurrentUser('id') uid: string) { return this.svc.getReports(uid); }
  @Get('loyalty')    loyalty(@CurrentUser('id') uid: string) { return this.svc.getLoyalty(uid); }
  @Get('sourcing')   sourcing(@CurrentUser('id') uid: string) { return this.svc.getSourcing(uid); }

  @Get('accounts') accounts(@CurrentUser('id') uid: string) { return this.journal.listAccounts(uid); }
  @Get('journal')  journal_(@CurrentUser('id') uid: string) { return this.journal.list(uid); }
}
