import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ErpService } from './erp.service';
import { JournalService } from './journal.service';
import { LoyaltyCustomer, Supplier } from './erp.entity';

@UseGuards(JwtAuthGuard)
@Controller('erp')
export class ErpController {
  constructor(
    private readonly svc: ErpService,
    private readonly journal: JournalService,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
    @InjectRepository(LoyaltyCustomer) private readonly loyaltyCustomers: Repository<LoyaltyCustomer>,
  ) {}

  @Get('dashboard')  dashboard(@CurrentUser('id') uid: string) { return this.svc.getDashboard(uid); }
  @Get('accounting') accounting(@CurrentUser('id') uid: string) { return this.svc.getAccounting(uid); }
  @Get('reports')    reports(@CurrentUser('id') uid: string) { return this.svc.getReports(uid); }
  @Get('loyalty')    loyalty(@CurrentUser('id') uid: string) { return this.svc.getLoyalty(uid); }
  @Get('sourcing')   sourcing(@CurrentUser('id') uid: string) { return this.svc.getSourcing(uid); }

  @Get('accounts') accounts(@CurrentUser('id') uid: string) { return this.journal.listAccounts(uid); }
  @Get('journal')  journal_(@CurrentUser('id') uid: string) { return this.journal.list(uid); }

  /**
   * Post a manual journal entry from the Accounting UI. Validates lines
   * are balanced + accounts exist; returns the inserted ledger rows.
   */
  @Post('journal')
  postJournal(
    @CurrentUser('id') uid: string,
    @Body() dto: { date: string; description: string; lines: Array<{ code: string; debit?: number; credit?: number }> },
  ) {
    return this.journal.postManual(uid, dto);
  }

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

  /**
   * Adjust a loyalty customer's points (positive = earned, negative =
   * redeemed). Persists across reloads so the Loyalty Program tab
   * actually does something. Refuses to take a balance below zero.
   */
  @Patch('loyalty/customers/:id/points')
  async adjustLoyaltyPoints(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { delta: number; reason?: string },
  ): Promise<LoyaltyCustomer> {
    const customer = await this.loyaltyCustomers.findOne({ where: { id, ownerId: uid } });
    if (!customer) throw new NotFoundException('Loyalty customer not found');
    const delta = Number(dto.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      throw new BadRequestException('delta must be a non-zero number');
    }
    const next = customer.points + Math.round(delta);
    if (next < 0) throw new BadRequestException(`Insufficient points (balance ${customer.points}, requested ${delta})`);
    customer.points = next;
    return this.loyaltyCustomers.save(customer);
  }
}
