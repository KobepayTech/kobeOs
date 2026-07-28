import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import {
  CancelPropertyPaymentOrderDto,
  CreateCollectionPartnerDto,
  CreatePropertyPaymentOrderDto,
  PartnerLoginDto,
  RedeemPropertyPaymentOrderDto,
} from './dto/property-payment-order.dto';
import { PropertyPaymentOrderService } from './property-payment-order.service';
import type { PropertyPaymentOrderStatus } from './property-payment-order.entity';

@UseGuards(JwtAuthGuard)
@Controller('property/payment-orders')
export class PropertyPaymentOrderController {
  constructor(private readonly service: PropertyPaymentOrderService) {}

  @Get()
  list(
    @CurrentUser('id') ownerId: string,
    @Query('status') status?: PropertyPaymentOrderStatus,
  ) {
    return this.service.listOrders(ownerId, status);
  }

  @Post()
  create(
    @CurrentUser('id') ownerId: string,
    @Body() dto: CreatePropertyPaymentOrderDto,
  ) {
    return this.service.createOrder(ownerId, dto);
  }

  @Delete(':id')
  cancel(
    @CurrentUser('id') ownerId: string,
    @Param('id') id: string,
    @Body() dto: CancelPropertyPaymentOrderDto,
  ) {
    return this.service.cancelOrder(ownerId, id, dto);
  }

  @Get('partners/list')
  partners(@CurrentUser('id') ownerId: string) {
    return this.service.listPartners(ownerId);
  }

  @Post('partners')
  createPartner(
    @CurrentUser('id') ownerId: string,
    @Body() dto: CreateCollectionPartnerDto,
  ) {
    return this.service.createPartner(ownerId, dto);
  }

  @Get('reconciliation/report')
  reconciliation(
    @CurrentUser('id') ownerId: string,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.service.reconciliation(ownerId, partnerId);
  }

  @Post('redemptions/:id/reverse')
  reverse(
    @CurrentUser('id') ownerId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.service.reverse(ownerId, id, reason ?? '');
  }
}

@Public()
@Controller('property/collection')
export class PropertyCollectionPortalController {
  constructor(private readonly service: PropertyPaymentOrderService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: PartnerLoginDto) {
    return this.service.login(dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('orders/:code')
  lookup(
    @Headers('x-property-agent-session') session: string,
    @Param('code') code: string,
  ) {
    return this.service.lookupForPartner(session ?? '', code);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('orders/:code/redeem')
  redeem(
    @Headers('x-property-agent-session') session: string,
    @Param('code') code: string,
    @Body() dto: RedeemPropertyPaymentOrderDto,
  ) {
    return this.service.redeem(session ?? '', code, dto);
  }
}
