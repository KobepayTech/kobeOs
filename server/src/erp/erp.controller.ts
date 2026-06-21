import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ErpService } from './erp.service';
import { JournalService } from './journal.service';
import { SupplierPaymentsService, RecordPaymentDto } from './supplier-payments.service';
import { LoyaltyCustomer, Supplier } from './erp.entity';

@UseGuards(JwtAuthGuard)
@Controller('erp')
export class ErpController {
  constructor(
    private readonly svc: ErpService,
    private readonly journal: JournalService,
    private readonly supplierPayments: SupplierPaymentsService,
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

  /** Phone-based supplier lookup — used by the KobePay payout flow
   *  to find out "is this number one of my suppliers?". Returns 404
   *  when no match so the caller can show "create new supplier"
   *  inline instead of silently swallowing the lookup. */
  @Get('sourcing/suppliers/match')
  async matchSupplierByPhone(@CurrentUser('id') uid: string, @Query('phone') phone?: string) {
    if (!phone) throw new BadRequestException('phone query param is required');
    const supplier = await this.supplierPayments.findByPhone(uid, phone);
    if (!supplier) throw new NotFoundException('No supplier with that phone');
    return supplier;
  }

  /** Open POs for a supplier — drives the "what is this payment for?"
   *  modal that pops up after a KobePay payout. Empty array when the
   *  supplier has no unpaid POs (UI then jumps straight to the
   *  NEW_GOODS / GENERAL choice). */
  @Get('sourcing/suppliers/:id/open-pos')
  listOpenPosForSupplier(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.supplierPayments.listOpenPos(uid, id);
  }

  /** All payments recorded against a supplier — for the supplier
   *  detail drawer ("here's the running total of what you've paid
   *  Mama Rose"). */
  @Get('sourcing/suppliers/:id/payments')
  listSupplierPayments(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.supplierPayments.listForSupplier(uid, id);
  }

  /** Record a payment to a supplier. Called from the reconciliation
   *  modal that pops up after a KobePay payout, OR directly from the
   *  sourcing UI when paying a supplier by cash / bank transfer. */
  @Post('sourcing/supplier-payments')
  recordSupplierPayment(@CurrentUser('id') uid: string, @Body() dto: RecordPaymentDto) {
    return this.supplierPayments.record(uid, dto);
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
