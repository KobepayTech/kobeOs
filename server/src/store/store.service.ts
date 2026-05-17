import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { PosProduct } from '../pos/pos.entity';

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
  ) {}

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
