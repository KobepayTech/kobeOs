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
}
