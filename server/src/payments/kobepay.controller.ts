import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  KobePayAllocationsService,
  KobePayCustomersService,
  KobePayDepositsService,
  KobePayPayoutsService,
  KobePaySuppliersService,
} from './kobepay.service';
import { KobePayCashierPerfService, KobePayOwnerService, KobePayRiskService } from './kobepay-owner.service';
import { KobePayRbacService, AuditContext } from './kobepay-rbac.service';
import { KobePayRatesService, UpsertRateInput } from './kobepay-rate.service';
import { KobePayRole } from './kobepay-rbac.entity';
import {
  ConfirmDepositDto,
  CreateAllocationDto,
  CreateDepositDto,
  CreatePayoutDto,
  UpdateCustomerDto,
  UpdatePayoutStatusDto,
  UpdateSupplierDto,
  UpsertCustomerDto,
  UpsertSupplierDto,
} from './dto/kobepay.dto';

@UseGuards(JwtAuthGuard)
@Controller('kobepay')
export class KobePayController {
  constructor(
    private readonly customers: KobePayCustomersService,
    private readonly suppliers: KobePaySuppliersService,
    private readonly deposits: KobePayDepositsService,
    private readonly payouts: KobePayPayoutsService,
    private readonly allocations: KobePayAllocationsService,
    private readonly owner: KobePayOwnerService,
    private readonly rbac: KobePayRbacService,
    private readonly cashierPerf: KobePayCashierPerfService,
    private readonly risk: KobePayRiskService,
    private readonly rates: KobePayRatesService,
  ) {}

  /* ── Exchange rates ── */
  @Get('rates/active') activeRates(@CurrentUser('id') uid: string) {
    return this.rates.active(uid);
  }
  @Get('rates')
  async listRates(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string) {
    return this.rates.list(uid, await this.ctx(uid, pin));
  }
  @Post('rates')
  async setRate(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Body() dto: UpsertRateInput) {
    return this.rates.setRate(uid, await this.ctx(uid, pin), dto);
  }
  @Patch('rates/:id/deactivate')
  async deactivateRate(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Param('id') id: string) {
    return this.rates.deactivate(uid, await this.ctx(uid, pin), id);
  }

  private async ctx(uid: string, pin?: string): Promise<AuditContext> {
    return { user: await this.rbac.resolveActor(uid, pin) };
  }

  /* ── Owner Profit Dashboard ── */
  @Get('owner-dashboard') ownerDashboard(@CurrentUser('id') uid: string) {
    return this.owner.dashboard(uid);
  }

  /* ── Cashier performance + Risk + Audit ── */
  @Get('cashier-performance') cashierPerformance(@CurrentUser('id') uid: string) {
    return this.cashierPerf.dashboard(uid);
  }
  @Get('risk') riskDashboard(@CurrentUser('id') uid: string) {
    return this.risk.dashboard(uid);
  }
  @Get('audit') auditLog(@CurrentUser('id') uid: string, @Query('limit') limit?: string) {
    return this.rbac.listAudit(uid, limit ? parseInt(limit, 10) : 200);
  }

  /* ── Sub-users (RBAC) ── */
  @Get('users') listUsers(@CurrentUser('id') uid: string) { return this.rbac.list(uid); }
  @Post('users')
  createUser(@CurrentUser('id') uid: string, @Body() dto: { name: string; role: KobePayRole; pin: string; phone?: string }) {
    return this.rbac.create(uid, dto);
  }
  @Patch('users/:id')
  updateUser(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { name?: string; role?: KobePayRole; phone?: string; active?: boolean; permissions?: Record<string, boolean> | null },
  ) {
    return this.rbac.update(uid, id, dto);
  }
  @Delete('users/:id')
  removeUser(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.rbac.remove(uid, id);
  }

  /* ── Customers ── */
  @Get('customers')
  async listCustomers(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Query('q') q?: string) {
    return this.customers.list(uid, await this.ctx(uid, pin), q);
  }
  @Get('customers/by-phone/:phone')
  async byPhone(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Param('phone') phone: string) {
    return this.customers.byPhone(uid, await this.ctx(uid, pin), phone);
  }
  @Post('customers')
  async upsertCustomer(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Body() dto: UpsertCustomerDto) {
    return this.customers.upsert(uid, await this.ctx(uid, pin), dto);
  }
  @Patch('customers/:id')
  async updateCustomer(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(uid, await this.ctx(uid, pin), id, dto);
  }
  @Delete('customers/:id')
  async removeCustomer(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Param('id') id: string) {
    return this.customers.remove(uid, await this.ctx(uid, pin), id);
  }

  /* ── Suppliers ── */
  @Get('suppliers')
  async listSuppliers(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string) {
    return this.suppliers.list(uid, await this.ctx(uid, pin));
  }
  @Post('suppliers')
  async createSupplier(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Body() dto: UpsertSupplierDto) {
    return this.suppliers.create(uid, await this.ctx(uid, pin), dto);
  }
  @Patch('suppliers/:id')
  async updateSupplier(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(uid, await this.ctx(uid, pin), id, dto);
  }
  @Delete('suppliers/:id')
  async removeSupplier(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Param('id') id: string) {
    return this.suppliers.remove(uid, await this.ctx(uid, pin), id);
  }

  /* ── Deposits ── */
  @Get('deposits') listDeposits(@CurrentUser('id') uid: string) { return this.deposits.list(uid); }
  @Post('deposits')
  async createDeposit(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Body() dto: CreateDepositDto) {
    return this.deposits.create(uid, await this.ctx(uid, pin), dto);
  }
  @Patch('deposits/:id/status')
  async confirmDeposit(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Param('id') id: string, @Body() dto: ConfirmDepositDto) {
    return this.deposits.setStatus(uid, await this.ctx(uid, pin), id, dto);
  }

  /* ── Payouts ── */
  @Get('payouts') listPayouts(@CurrentUser('id') uid: string) { return this.payouts.list(uid); }
  @Post('payouts')
  async createPayout(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Body() dto: CreatePayoutDto) {
    return this.payouts.create(uid, await this.ctx(uid, pin), dto);
  }
  @Patch('payouts/:id/status')
  async updatePayoutStatus(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Param('id') id: string, @Body() dto: UpdatePayoutStatusDto) {
    return this.payouts.updateStatus(uid, await this.ctx(uid, pin), id, dto);
  }

  /* ── Allocations ── */
  @Get('allocations') listAllocations(@CurrentUser('id') uid: string) { return this.allocations.list(uid); }
  @Post('allocations')
  async createAllocation(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string, @Body() dto: CreateAllocationDto) {
    return this.allocations.create(uid, await this.ctx(uid, pin), dto);
  }
}
