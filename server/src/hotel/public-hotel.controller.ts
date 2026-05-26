import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import {
  MenuItemsService, OrdersService, ServiceRequestsService, TenantsService,
} from './hotel.service';
import { CreateOrderDto, CreateServiceRequestDto } from './dto/hotel.dto';

/**
 * Unauthenticated guest endpoints. The tenant is identified by URL slug, never
 * by JWT, so a phone scanning a QR can fetch the menu and place orders without
 * an account. Owner-scoping is enforced by resolving slug → ownerId server-side.
 */
@Controller('public/hotel')
export class PublicHotelController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly menu: MenuItemsService,
    private readonly orders: OrdersService,
    private readonly serviceRequests: ServiceRequestsService,
  ) {}

  private async resolveOwnerId(slug: string): Promise<string> {
    const tenant = await this.tenants.findBySlug(slug.toLowerCase());
    if (!tenant) throw new NotFoundException(`Tenant '${slug}' not found`);
    return tenant.ownerId;
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
    };
  }

  @Get(':slug/menu-items')
  async listMenu(@Param('slug') slug: string) {
    const ownerId = await this.resolveOwnerId(slug);
    const items = await this.menu.list(ownerId, { page: 1, limit: 100 });
    return items.filter((m) => m.available);
  }

  @Post(':slug/orders')
  async placeOrder(@Param('slug') slug: string, @Body() dto: CreateOrderDto) {
    const ownerId = await this.resolveOwnerId(slug);
    // The dto is validated by the global pipe. We trust nothing beyond it.
    return this.orders.placeOrder(ownerId, dto);
  }

  @Get(':slug/orders/:id')
  async getOrder(@Param('slug') slug: string, @Param('id') id: string) {
    const ownerId = await this.resolveOwnerId(slug);
    try {
      return await this.orders.get(ownerId, id);
    } catch {
      throw new NotFoundException('Order not found');
    }
  }

  @Post(':slug/service-requests')
  async placeServiceRequest(@Param('slug') slug: string, @Body() dto: CreateServiceRequestDto) {
    const ownerId = await this.resolveOwnerId(slug);
    if (!dto?.roomNumber || !dto?.kind) {
      throw new BadRequestException('roomNumber and kind are required');
    }
    return this.serviceRequests.create(ownerId, {
      roomNumber: dto.roomNumber,
      kind: dto.kind,
      note: dto.note ?? '',
      status: 'OPEN',
    });
  }
}
