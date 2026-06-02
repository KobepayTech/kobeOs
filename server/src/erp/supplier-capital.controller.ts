import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import {
  AttachReceiptToPoDto,
  AttachReceiptToSupplierDto,
  CreateKobePayLinkDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  KobePaySupplierReceiptWebhookDto,
  MarkReceiptDto,
} from './dto/supplier-capital.dto';
import { SupplierCapitalService } from './supplier-capital.service';

@Controller('erp/supplier-capital')
export class SupplierCapitalController {
  constructor(private readonly svc: SupplierCapitalService) {}

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  summary(@CurrentUser('id') uid: string) {
    return this.svc.summary(uid);
  }

  @UseGuards(JwtAuthGuard)
  @Get('links')
  links(@CurrentUser('id') uid: string) {
    return this.svc.listLinks(uid);
  }

  @UseGuards(JwtAuthGuard)
  @Post('links')
  createLink(@CurrentUser('id') uid: string, @Body() dto: CreateKobePayLinkDto) {
    return this.svc.createLink(uid, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('suppliers')
  suppliers(@CurrentUser('id') uid: string) {
    return this.svc.listSuppliers(uid);
  }

  @UseGuards(JwtAuthGuard)
  @Post('suppliers')
  createSupplier(@CurrentUser('id') uid: string, @Body() dto: CreateSupplierDto) {
    return this.svc.createSupplier(uid, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('purchase-orders')
  purchaseOrders(@CurrentUser('id') uid: string, @Query('supplierId') supplierId?: string) {
    return this.svc.listPurchaseOrders(uid, supplierId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase-orders')
  createPurchaseOrder(@CurrentUser('id') uid: string, @Body() dto: CreatePurchaseOrderDto) {
    return this.svc.createPurchaseOrder(uid, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('receipts')
  receipts(@CurrentUser('id') uid: string, @Query('status') status?: string) {
    return this.svc.listReceipts(uid, status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unallocated')
  unallocated(@CurrentUser('id') uid: string) {
    return this.svc.listReceipts(uid, 'po_missing');
  }

  @UseGuards(JwtAuthGuard)
  @Patch('receipts/:id/attach-supplier')
  attachSupplier(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: AttachReceiptToSupplierDto) {
    return this.svc.attachSupplier(uid, id, dto.supplierId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('receipts/:id/attach-po')
  attachPo(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: AttachReceiptToPoDto) {
    return this.svc.attachPo(uid, id, dto.poId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('receipts/:id/mark')
  markReceipt(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: MarkReceiptDto) {
    return this.svc.markReceipt(uid, id, dto.status, dto.notes);
  }

  @Public()
  @Post('kobepay/webhook')
  importKobePayReceipt(@Body() dto: KobePaySupplierReceiptWebhookDto, @Headers('x-kobepay-webhook-secret') secret?: string) {
    const expectedSecret = process.env.KOBEPAY_WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) throw new UnauthorizedException('Invalid KobePay webhook secret');
    return this.svc.importKobePayReceipt(dto);
  }
}
