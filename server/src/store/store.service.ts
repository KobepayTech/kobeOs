import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { PosOrder, PosOrderItem, PosProduct } from '../pos/pos.entity';
import { WarehousePickTicket } from '../warehouse/pick-ticket.entity';
import { OrdersService } from '../pos/pos.service';
import { CreateOrderDto } from '../pos/dto/pos.dto';
import { CreditService } from '../credit/credit.service';

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
    @InjectRepository(PosOrder)
    private readonly orderRepo: Repository<PosOrder>,
    @InjectRepository(PosOrderItem)
    private readonly itemRepo: Repository<PosOrderItem>,
    @InjectRepository(WarehousePickTicket)
    private readonly pickTicketRepo: Repository<WarehousePickTicket>,
    private readonly orders: OrdersService,
    private readonly credit: CreditService,
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
   * Public BNPL eligibility check. The buyer hasn't authenticated yet —
   * we look them up by phone within this store's owner scope. Returns a
   * compact verdict the storefront can show inline; never leaks names,
   * risk grades, or other internal credit profile fields.
   */
  async eligibility(slugOrDomain: string, phone: string) {
    const ownerId = await this.resolveOwner(slugOrDomain);
    if (!phone?.trim()) {
      return { eligible: false, availableCredit: 0, creditLimit: 0, currency: 'TZS', reason: 'no_phone' as const };
    }
    return this.credit.checkEligibility(ownerId, phone.trim());
  }

  /**
   * Public order tracker. Buyer's order number + phone proves they own
   * the order without needing a JWT. Returns the order summary + lines +
   * pick-ticket status so they can see "your package is being packed".
   */
  async trackOrder(slugOrDomain: string, orderNumber: string, phone: string) {
    const ownerId = await this.resolveOwner(slugOrDomain);
    const order = await this.orderRepo.findOne({ where: { ownerId, orderNumber } });
    if (!order) throw new NotFoundException('Order not found');
    // Mismatched phone is reported as "not found" so we don't confirm an
    // order exists when the wrong phone is supplied (no enumeration).
    if (!phone || order.customerPhone !== phone) {
      throw new NotFoundException('Order not found');
    }
    const items = await this.itemRepo.find({ where: { ownerId, orderId: order.id } });
    const pickTicket = await this.pickTicketRepo.findOne({ where: { ownerId, orderId: order.id } });
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName,
      placedAt: order.createdAt,
      items: items.map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
      pickTicket: pickTicket
        ? { ticketNumber: pickTicket.ticketNumber, status: pickTicket.status }
        : null,
    };
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

    // Compute priceMin/priceMax from variants so the storefront card can show
    // the "$17.99 ~ $28.99" range — when no per-variant price is set the
    // parent price is the single price and we leave min/max null.
    const enriched = products.map((p) => {
      const variantPrices = (p.variants ?? [])
        .map((v) => (typeof v.price === 'number' ? Number(v.price) : null))
        .filter((n): n is number => n !== null && Number.isFinite(n) && n > 0);
      if (variantPrices.length === 0) {
        return { ...p, priceMin: null, priceMax: null };
      }
      return {
        ...p,
        priceMin: Math.min(Number(p.price), ...variantPrices),
        priceMax: Math.max(Number(p.price), ...variantPrices),
      };
    });

    return { settings, products: enriched as unknown as PosProduct[], total };
  }
}
