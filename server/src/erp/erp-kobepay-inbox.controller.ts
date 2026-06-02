import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { ErpKobepayInboxService, InboundReceipt } from './erp-kobepay-inbox.service';
import { ErpKobepayInboxStatus } from './erp-kobepay-inbox.entity';

@Controller('erp/kobepay-inbox')
export class ErpKobepayInboxController {
  constructor(private readonly svc: ErpKobepayInboxService) {}

  /* ─── Inbound webhook (bearer-key auth, NOT JWT) ─── */

  @Public()
  @Post()
  async receiveReceipt(
    @Headers('authorization') auth: string,
    @Body() dto: InboundReceipt,
  ) {
    const provider = await this.svc.authenticate(auth);
    return this.svc.ingest(provider, dto);
  }

  /* ─── ERP-owner provider management (JWT) ─── */

  @UseGuards(JwtAuthGuard)
  @Get('providers')
  listProviders(@CurrentUser('id') uid: string) {
    return this.svc.listProviders(uid);
  }

  @UseGuards(JwtAuthGuard)
  @Post('providers')
  createProvider(@CurrentUser('id') uid: string, @Body() dto: { name: string; contactEmail?: string; notes?: string }) {
    return this.svc.createProvider(uid, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('providers/:id')
  toggleProvider(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { active: boolean },
  ) {
    return this.svc.toggleProvider(uid, id, dto.active);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('providers/:id')
  deleteProvider(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.deleteProvider(uid, id);
  }

  /* ─── ERP-owner inbox resolution (JWT) ─── */

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser('id') uid: string, @Query('status') status?: ErpKobepayInboxStatus) {
    return this.svc.list(uid, status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  summary(@CurrentUser('id') uid: string) {
    return this.svc.summary(uid);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/attach-supplier')
  attachSupplier(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { supplierId: string },
  ) {
    return this.svc.attachSupplier(uid, id, dto.supplierId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/create-supplier')
  createSupplier(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { name?: string; country?: string },
  ) {
    return this.svc.createSupplierAndAttach(uid, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/expense')
  markExpense(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { notes?: string },
  ) {
    return this.svc.markExpense(uid, id, dto.notes);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/defer')
  defer(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.defer(uid, id);
  }
}
