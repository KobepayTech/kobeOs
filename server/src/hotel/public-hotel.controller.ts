import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import {
  MenuItemsService, OrdersService, ServiceRequestsService, TenantsService,
} from './hotel.service';
import { CreateOrderDto, CreateServiceRequestDto } from './dto/hotel.dto';
import { Public } from '../common/public.decorator';

/**
 * Unauthenticated guest endpoints. The tenant is identified by URL slug, never
 * by JWT, so a phone scanning a QR can fetch the menu and place orders without
 * an account. Owner-scoping is enforced by resolving slug → ownerId server-side.
 */
@Public()
@Controller('public/hotel')
export class PublicHotelController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly menu: MenuItemsService,
    private readonly orders: OrdersService,
    private readonly serviceRequests: ServiceRequestsService,
  ) {}

  private async resolveTenant(slug: string) {
    const tenant = await this.tenants.findBySlug(slug.toLowerCase());
    if (!tenant) throw new NotFoundException(`Tenant '${slug}' not found`);
    return tenant;
  }

  @Get(':slug')
  async getTenant(@Param('slug') slug: string) {
    const tenant = await this.tenants.findBySlug(slug.toLowerCase());
    if (!tenant) throw new NotFoundException(`Tenant '${slug}' not found`);
    // Don't leak ownerId to the public.
    return {
      slug: tenant.slug,
      name: tenant.name,
      brandColor: tenant.brandColor,
      logoUrl: tenant.logoUrl,
      currency: tenant.currency,
      location: tenant.location,
      phone: tenant.phone,
      email: tenant.email,
    };
  }

  @Get(':slug/menu-items')
  async listMenu(@Param('slug') slug: string) {
    const tenant = await this.resolveTenant(slug);
    return this.menu.listForHotel(tenant.ownerId, tenant.id);
  }

  @Post(':slug/orders')
  async placeOrder(@Param('slug') slug: string, @Body() dto: CreateOrderDto) {
    const tenant = await this.resolveTenant(slug);
    // The dto is validated by the global pipe. We trust nothing beyond it.
    return this.orders.placeOrder(tenant.ownerId, dto, tenant.id, true);
  }

  @Get(':slug/orders/:id')
  async getOrder(@Param('slug') slug: string, @Param('id') id: string) {
    const tenant = await this.resolveTenant(slug);
    try {
      const order = await this.orders.get(tenant.ownerId, id);
      if (order.hotelId !== tenant.id) throw new NotFoundException('Order not found');
      return order;
    } catch {
      throw new NotFoundException('Order not found');
    }
  }

  @Post(':slug/service-requests')
  async placeServiceRequest(@Param('slug') slug: string, @Body() dto: CreateServiceRequestDto) {
    const tenant = await this.resolveTenant(slug);
    if (!dto?.roomNumber || !dto?.kind) {
      throw new BadRequestException('roomNumber and kind are required');
    }
    return this.serviceRequests.create(tenant.ownerId, {
      roomNumber: dto.roomNumber,
      kind: dto.kind,
      note: dto.note ?? '',
      status: 'OPEN',
      hotelId: tenant.id,
    });
  }
}
