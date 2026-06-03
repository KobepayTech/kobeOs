import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { PosProduct } from '../pos/pos.entity';
import { OrdersService } from '../pos/pos.service';
import { CreateOrderDto } from '../pos/dto/pos.dto';

export interface PublicStoreResponse {
  settings: StoreSettings;
  products: PosProduct[];
  total: number;
}

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(StoreSettings)
    private readonly settingsRepo: Repository<StoreSettings>,
    @InjectRepository(PosProduct)
    private readonly productsRepo: Repository<PosProduct>,
    private readonly orders: OrdersService,
  ) {}

  /** Resolve a slug or custom domain to the store owner's userId. */
  async resolveOwner(slugOrDomain: string): Promise<string> {
    const settings =
      (await this.settingsRepo.findOne({ where: { domainSlug: slugOrDomain } })) ??
      (await this.settingsRepo.findOne({ where: { customDomain: slugOrDomain } }));
    if (!settings) throw new NotFoundException('Store not found');
    return settings.ownerId;
  }

  /**
   * Place a storefront order. Public visitor — no JWT — so we resolve
   * the owner from the slug and call the existing OrdersService.create
   * under that owner's context. The OrdersService already runs the
   * full atomic transaction: stock deduct (PosProduct + WarehouseItem
   * if matching SKU exists), discount engine, BNPL credit check,
   * pick ticket creation, journal entry, formatted receipt.
   */
  async placeOrder(slugOrDomain: string, dto: CreateOrderDto) {
    const ownerId = await this.resolveOwner(slugOrDomain);
    return this.orders.create(ownerId, dto);
  }

  /**
   * Resolve a store by domainSlug or customDomain and return its
   * public-facing settings + active product catalogue.
   */
  async getPublicStore(
    slugOrDomain: string,
    page = 1,
    limit = 24,
  ): Promise<PublicStoreResponse> {
    // Try slug first, then custom domain
    const settings =
      (await this.settingsRepo.findOne({ where: { domainSlug: slugOrDomain } })) ??
      (await this.settingsRepo.findOne({ where: { customDomain: slugOrDomain } }));

    if (!settings) throw new NotFoundException('Store not found');

    const [products, total] = await this.productsRepo.findAndCount({
      where: { ownerId: settings.ownerId, active: true },
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { settings, products, total };
  }
}
