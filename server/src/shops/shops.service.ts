import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Shop } from './shop.entity';

interface UpsertShopDto {
  name?: string;
  address?: string;
  phone?: string;
  region?: string;
  openingFloat?: number;
  currency?: string;
  isDefault?: boolean;
  active?: boolean;
}

@Injectable()
export class ShopsService {
  constructor(@InjectRepository(Shop) private readonly repo: Repository<Shop>) {}

  list(ownerId: string) {
    return this.repo.find({ where: { ownerId }, order: { isDefault: 'DESC', name: 'ASC' } });
  }

  async getDefault(ownerId: string): Promise<Shop> {
    // Return the explicit default, otherwise auto-create a "Main shop" so a
    // brand-new install always has at least one shop to attribute sales to.
    const existing = await this.repo.findOne({ where: { ownerId } });
    if (!existing) {
      return this.repo.save(
        this.repo.create({
          ownerId,
          name: 'Main shop',
          isDefault: true,
        }),
      );
    }
    const def = await this.repo.findOne({ where: { ownerId, isDefault: true } });
    return def ?? existing;
  }

  async create(ownerId: string, dto: UpsertShopDto): Promise<Shop> {
    if (!dto.name?.trim()) throw new BadRequestException('Shop name is required');

    // First shop becomes the default automatically.
    const count = await this.repo.count({ where: { ownerId } });
    const isDefault = count === 0 ? true : !!dto.isDefault;

    if (isDefault) {
      // Demote any existing default so there's only ever one.
      await this.repo
        .createQueryBuilder()
        .update(Shop)
        .set({ isDefault: false })
        .where('"ownerId" = :ownerId', { ownerId })
        .execute();
    }

    return this.repo.save(
      this.repo.create({
        ownerId,
        name: dto.name.trim(),
        address: dto.address ?? '',
        phone: dto.phone ?? '',
        region: dto.region ?? '',
        openingFloat: dto.openingFloat ?? 0,
        currency: dto.currency ?? 'TZS',
        isDefault,
        active: dto.active ?? true,
      }),
    );
  }

  async update(ownerId: string, id: string, dto: UpsertShopDto): Promise<Shop> {
    const shop = await this.repo.findOne({ where: { ownerId, id } });
    if (!shop) throw new NotFoundException('Shop not found');

    if (dto.isDefault === true && !shop.isDefault) {
      await this.repo
        .createQueryBuilder()
        .update(Shop)
        .set({ isDefault: false })
        .where('"ownerId" = :ownerId AND id != :id', { ownerId, id })
        .execute();
    }

    Object.assign(shop, {
      name:         dto.name ?? shop.name,
      address:      dto.address ?? shop.address,
      phone:        dto.phone ?? shop.phone,
      region:       dto.region ?? shop.region,
      openingFloat: dto.openingFloat ?? shop.openingFloat,
      currency:     dto.currency ?? shop.currency,
      isDefault:    dto.isDefault ?? shop.isDefault,
      active:       dto.active ?? shop.active,
    });
    return this.repo.save(shop);
  }

  async remove(ownerId: string, id: string) {
    const shop = await this.repo.findOne({ where: { ownerId, id } });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.isDefault) {
      const other = await this.repo.findOne({ where: { ownerId, id: Not(id) } });
      if (other) {
        other.isDefault = true;
        await this.repo.save(other);
      }
    }
    await this.repo.remove(shop);
    return { removed: true };
  }

  /**
   * Validates that the supplied shopId belongs to this owner. Used by every
   * shop-scoped consumer (POS orders, expenses, EOD) so a bad header can't
   * spill writes across tenants.
   */
  async assertOwned(ownerId: string, shopId: string): Promise<Shop> {
    const shop = await this.repo.findOne({ where: { ownerId, id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found for this owner');
    return shop;
  }
}
