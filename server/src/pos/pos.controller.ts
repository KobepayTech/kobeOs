import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService, ProductsService } from './pos.service';
import { CreateOrderDto, CreateProductDto, UpdateOrderDto, UpdateProductDto } from './dto/pos.dto';

@UseGuards(JwtAuthGuard)
@Controller('pos')
export class PosController {
  constructor(
    private readonly products: ProductsService,
    private readonly orders: OrdersService,
  ) {}

  @Get('products') listProducts(@CurrentUser('id') uid: string) { return this.products.list(uid); }
  @Get('products/:id') getProduct(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.products.get(uid, id); }
  @Post('products') createProduct(@CurrentUser('id') uid: string, @Body() dto: CreateProductDto) { return this.products.create(uid, dto); }
  @Patch('products/:id') updateProduct(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateProductDto) { return this.products.update(uid, id, dto); }
  @Delete('products/:id') removeProduct(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.products.remove(uid, id); }

  @Get('orders') listOrders(@CurrentUser('id') uid: string) { return this.orders.list(uid); }
  @Get('orders/:id') getOrder(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.orders.get(uid, id); }
  @Post('orders') createOrder(@CurrentUser('id') uid: string, @Body() dto: CreateOrderDto) { return this.orders.create(uid, dto); }
  @Patch('orders/:id') updateOrder(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateOrderDto) { return this.orders.update(uid, id, dto); }

  // ── Fulfillment workflow (Kitchen Display System) ───────────────────────
  // TV display loads /pos/orders/kds on mount and then subscribes to the
  // /pos socket namespace for live updates. Mobile "prepare" screen calls
  // the three transition endpoints when staff tap the action buttons.
  @Get('orders/kds') listForKds(@CurrentUser('id') uid: string) { return this.orders.listForKds(uid); }
  @Post('orders/:id/start')     start(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.orders.markPreparing(uid, id); }
  @Post('orders/:id/ready')     ready(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.orders.markReady(uid, id); }
  @Post('orders/:id/collected') collected(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.orders.markCollected(uid, id); }
}
