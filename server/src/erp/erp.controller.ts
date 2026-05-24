import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AccountsService, LoyaltyCustomersService, PointsService, PurchaseOrdersService,
  RewardsService, SuppliersService, TransactionsService,
} from './erp.service';
import { ErpSummaryService } from './erp.summary.service';
import {
  CreateAccountDto, CreateLoyaltyCustomerDto, CreatePointsEntryDto, CreatePurchaseOrderDto,
  CreateRewardDto, CreateSupplierDto, CreateTransactionDto,
  UpdateAccountDto, UpdateLoyaltyCustomerDto, UpdatePointsEntryDto, UpdatePurchaseOrderDto,
  UpdateRewardDto, UpdateSupplierDto, UpdateTransactionDto,
} from './dto/erp.dto';

@UseGuards(JwtAuthGuard)
@Controller('erp')
export class ErpController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly transactions: TransactionsService,
    private readonly loyaltyCustomers: LoyaltyCustomersService,
    private readonly rewards: RewardsService,
    private readonly points: PointsService,
    private readonly suppliers: SuppliersService,
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly summaryService: ErpSummaryService,
  ) {}

  @Get('summary') summary(@CurrentUser('id') uid: string) { return this.summaryService.summary(uid); }

  @Get('accounts') listAccounts(@CurrentUser('id') uid: string) { return this.accounts.list(uid); }
  @Post('accounts') createAccount(@CurrentUser('id') uid: string, @Body() dto: CreateAccountDto) { return this.accounts.create(uid, dto); }
  @Patch('accounts/:id') updateAccount(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateAccountDto) { return this.accounts.update(uid, id, dto); }
  @Delete('accounts/:id') removeAccount(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.accounts.remove(uid, id); }

  @Get('transactions') listTx(@CurrentUser('id') uid: string) { return this.transactions.list(uid); }
  @Post('transactions') createTx(@CurrentUser('id') uid: string, @Body() dto: CreateTransactionDto) { return this.transactions.create(uid, dto); }
  @Patch('transactions/:id') updateTx(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateTransactionDto) { return this.transactions.update(uid, id, dto); }
  @Delete('transactions/:id') removeTx(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.transactions.remove(uid, id); }

  @Get('loyalty-customers') listLoyal(@CurrentUser('id') uid: string) { return this.loyaltyCustomers.list(uid); }
  @Post('loyalty-customers') createLoyal(@CurrentUser('id') uid: string, @Body() dto: CreateLoyaltyCustomerDto) { return this.loyaltyCustomers.create(uid, dto); }
  @Patch('loyalty-customers/:id') updateLoyal(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateLoyaltyCustomerDto) { return this.loyaltyCustomers.update(uid, id, dto); }
  @Delete('loyalty-customers/:id') removeLoyal(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.loyaltyCustomers.remove(uid, id); }

  @Get('rewards') listRewards(@CurrentUser('id') uid: string) { return this.rewards.list(uid); }
  @Post('rewards') createReward(@CurrentUser('id') uid: string, @Body() dto: CreateRewardDto) { return this.rewards.create(uid, dto); }
  @Patch('rewards/:id') updateReward(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateRewardDto) { return this.rewards.update(uid, id, dto); }
  @Delete('rewards/:id') removeReward(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.rewards.remove(uid, id); }

  @Get('points') listPoints(@CurrentUser('id') uid: string) { return this.points.list(uid); }
  @Post('points') createPoints(@CurrentUser('id') uid: string, @Body() dto: CreatePointsEntryDto) { return this.points.create(uid, dto); }
  @Patch('points/:id') updatePoints(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePointsEntryDto) { return this.points.update(uid, id, dto); }
  @Delete('points/:id') removePoints(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.points.remove(uid, id); }

  @Get('suppliers') listSuppliers(@CurrentUser('id') uid: string) { return this.suppliers.list(uid); }
  @Post('suppliers') createSupplier(@CurrentUser('id') uid: string, @Body() dto: CreateSupplierDto) { return this.suppliers.create(uid, dto); }
  @Patch('suppliers/:id') updateSupplier(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateSupplierDto) { return this.suppliers.update(uid, id, dto); }
  @Delete('suppliers/:id') removeSupplier(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.suppliers.remove(uid, id); }

  @Get('purchase-orders') listPOs(@CurrentUser('id') uid: string) { return this.purchaseOrders.list(uid); }
  @Post('purchase-orders') createPO(@CurrentUser('id') uid: string, @Body() dto: CreatePurchaseOrderDto) { return this.purchaseOrders.create(uid, dto); }
  @Patch('purchase-orders/:id') updatePO(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) { return this.purchaseOrders.update(uid, id, dto); }
  @Delete('purchase-orders/:id') removePO(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.purchaseOrders.remove(uid, id); }
}
