import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ErpService } from './erp.service';
import { JournalService } from './journal.service';
import { Supplier } from './erp.entity';

@UseGuards(JwtAuthGuard)
@Controller('erp')
export class ErpController {
  constructor(
    private readonly svc: ErpService,
    private readonly journal: JournalService,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
  ) {}

  @Get('dashboard')  dashboard(@CurrentUser('id') uid: string) { return this.svc.getDashboard(uid); }
  @Get('accounting') accounting(@CurrentUser('id') uid: string) { return this.svc.getAccounting(uid); }
  @Get('reports')    reports(@CurrentUser('id') uid: string) { return this.svc.getReports(uid); }
  @Get('loyalty')    loyalty(@CurrentUser('id') uid: string) { return this.svc.getLoyalty(uid); }
  @Get('sourcing')   sourcing(@CurrentUser('id') uid: string) { return this.svc.getSourcing(uid); }

  @Get('accounts') accounts(@CurrentUser('id') uid: string) { return this.journal.listAccounts(uid); }
  @Get('journal')  journal_(@CurrentUser('id') uid: string) { return this.journal.list(uid); }

  /* ERP-owner supplier management — needed so receipts can resolve
   * against an owner-scoped vendor list. */
  @Get('sourcing/suppliers')
  listSuppliers(@CurrentUser('id') uid: string) {
    return this.suppliers.find({ where: { ownerId: uid }, order: { name: 'ASC' } });
  }
  @Post('sourcing/suppliers')
  createSupplier(@CurrentUser('id') uid: string, @Body() dto: { name: string; phone?: string; country?: string; contact?: string }) {
    return this.suppliers.save(this.suppliers.create({
      ownerId: uid,
      name: dto.name,
      phone: dto.phone ?? '',
      country: dto.country ?? '',
      contact: dto.contact ?? '',
      rating: 0,
      status: 'Active',
    }));
  }
}
