import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { KobePayReceiptsService } from './kobepay-receipts.service';
import { KobePayRbacService, AuditContext } from './kobepay-rbac.service';
import { CreateReceiptDto, PayReceiptDto } from './dto/payout-receipt.dto';

@UseGuards(JwtAuthGuard)
@Controller('kobepay/receipts')
export class KobePayReceiptsController {
  constructor(
    private readonly receipts: KobePayReceiptsService,
    private readonly rbac: KobePayRbacService,
  ) {}

  private async ctx(uid: string, pin?: string): Promise<AuditContext> {
    return { user: await this.rbac.resolveActor(uid, pin) };
  }

  @Get('dashboard')
  dashboard(@CurrentUser('id') uid: string) {
    return this.receipts.dashboard(uid);
  }

  @Get('analytics')
  analytics(
    @CurrentUser('id') uid: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('method') method?: string,
    @Query('cashier') cashier?: string,
    @Query('supplier') supplier?: string,
  ) {
    return this.receipts.analytics(uid, { from, to, method, cashier, supplier });
  }

  @Get()
  list(
    @CurrentUser('id') uid: string,
    @Query('status') status?: 'Pending' | 'Paid' | 'Cancelled',
    @Query('q') q?: string,
  ) {
    return this.receipts.list(uid, { status, q });
  }

  /** Load customer details and every receipt using a mobile number. */
  @Get('by-customer/:phone')
  byCustomer(@CurrentUser('id') uid: string, @Param('phone') phone: string) {
    return this.receipts.getByCustomerPhone(uid, phone);
  }

  @Get('by-number/:number')
  byNumber(@CurrentUser('id') uid: string, @Param('number') number: string) {
    return this.receipts.getByNumber(uid, number);
  }

  @Get('by-token/:token')
  byToken(@CurrentUser('id') uid: string, @Param('token') token: string) {
    return this.receipts.getByTokenOwned(uid, token);
  }

  @Post()
  async create(
    @CurrentUser('id') uid: string,
    @Headers('x-kobepay-pin') pin: string,
    @Body() dto: CreateReceiptDto,
  ) {
    return this.receipts.create(uid, await this.ctx(uid, pin), dto);
  }

  @Post(':id/pay')
  async pay(
    @CurrentUser('id') uid: string,
    @Headers('x-kobepay-pin') pin: string,
    @Param('id') id: string,
    @Body() dto: PayReceiptDto,
  ) {
    return this.receipts.pay(uid, await this.ctx(uid, pin), id, dto);
  }

  @Post('seed-demo')
  async seedDemo(@CurrentUser('id') uid: string, @Headers('x-kobepay-pin') pin: string) {
    return this.receipts.seedDemo(uid, await this.ctx(uid, pin));
  }
}

@Public()
@Controller('public/receipts')
export class PublicReceiptController {
  constructor(private readonly receipts: KobePayReceiptsService) {}

  @Get(':token')
  view(@Param('token') token: string) {
    return this.receipts.getPublic(token);
  }
}
