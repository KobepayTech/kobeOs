import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  KobePayAllocationsService,
  KobePayCustomersService,
  KobePayDepositsService,
  KobePayPayoutsService,
  KobePaySuppliersService,
} from './kobepay.service';
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
  ) {}

  /* ── Customers ── */
  @Get('customers')
  listCustomers(@CurrentUser('id') uid: string, @Query('q') q?: string) {
    return this.customers.list(uid, q);
  }
  @Get('customers/by-phone/:phone')
  byPhone(@CurrentUser('id') uid: string, @Param('phone') phone: string) {
    return this.customers.byPhone(uid, phone);
  }
  @Post('customers')
  upsertCustomer(@CurrentUser('id') uid: string, @Body() dto: UpsertCustomerDto) {
    return this.customers.upsert(uid, dto);
  }
  @Patch('customers/:id')
  updateCustomer(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(uid, id, dto);
  }
  @Delete('customers/:id')
  removeCustomer(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.customers.remove(uid, id);
  }

  /* ── Suppliers ── */
  @Get('suppliers') listSuppliers(@CurrentUser('id') uid: string) { return this.suppliers.list(uid); }
  @Post('suppliers') createSupplier(@CurrentUser('id') uid: string, @Body() dto: UpsertSupplierDto) { return this.suppliers.create(uid, dto); }
  @Patch('suppliers/:id') updateSupplier(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateSupplierDto) { return this.suppliers.update(uid, id, dto); }
  @Delete('suppliers/:id') removeSupplier(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.suppliers.remove(uid, id); }

  /* ── Deposits ── */
  @Get('deposits') listDeposits(@CurrentUser('id') uid: string) { return this.deposits.list(uid); }
  @Post('deposits') createDeposit(@CurrentUser('id') uid: string, @Body() dto: CreateDepositDto) { return this.deposits.create(uid, dto); }
  @Patch('deposits/:id/status') confirmDeposit(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: ConfirmDepositDto) { return this.deposits.setStatus(uid, id, dto); }

  /* ── Payouts ── */
  @Get('payouts') listPayouts(@CurrentUser('id') uid: string) { return this.payouts.list(uid); }
  @Post('payouts') createPayout(@CurrentUser('id') uid: string, @Body() dto: CreatePayoutDto) { return this.payouts.create(uid, dto); }
  @Patch('payouts/:id/status') updatePayoutStatus(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePayoutStatusDto) { return this.payouts.updateStatus(uid, id, dto); }

  /* ── Allocations ── */
  @Get('allocations') listAllocations(@CurrentUser('id') uid: string) { return this.allocations.list(uid); }
  @Post('allocations') createAllocation(@CurrentUser('id') uid: string, @Body() dto: CreateAllocationDto) { return this.allocations.create(uid, dto); }
}
