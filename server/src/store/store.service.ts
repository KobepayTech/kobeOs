import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { PosOrder, PosOrderItem, PosProduct } from '../pos/pos.entity';
import { WarehousePickTicket } from '../warehouse/pick-ticket.entity';
import { ProductReview } from './product-review.entity';
import { OrdersService } from '../pos/pos.service';
import { CreateOrderDto } from '../pos/dto/pos.dto';
import { CreditService } from '../credit/credit.service';
import { Coupon } from '../discounts/discount.entity';
import { LoyaltyCustomer, LoyaltyPointsEntry } from '../erp/erp.entity';
import { LiveComment, LivePin, LiveSession } from '../live-sales/live-sale.entity';

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
    @InjectRepository(ProductReview)
    private readonly reviewsRepo: Repository<ProductReview>,
    @InjectRepository(Coupon)
    private readonly couponsRepo: Repository<Coupon>,
    @InjectRepository(LoyaltyCustomer)
    private readonly loyaltyRepo: Repository<LoyaltyCustomer>,
    @InjectRepository(LoyaltyPointsEntry)
    private readonly loyaltyPointsRepo: Repository<LoyaltyPointsEntry>,
    @InjectRepository(LiveComment)
    private readonly liveCommentsRepo: Repository<LiveComment>,
    @InjectRepository(LiveSession)
    private readonly liveSessionsRepo: Repository<LiveSession>,
    @InjectRepository(LivePin)
    private readonly livePinsRepo: Repository<LivePin>,
    private readonly orders: OrdersService,
    private readonly credit: CreditService,
  ) {}

  // ── Product reviews ─────────────────────────────────────────────────────
  /** Public: approved reviews for a product on this store. */
  async listReviews(slugOrDomain: string, productId: string) {
    const ownerId = await this.resolveOwner(slugOrDomain);
    return this.reviewsRepo.find({
      where: { ownerId, productId, approved: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
  /** Public: a customer submits a review (auto-approved so it shows live). */
  async addReview(slugOrDomain: string, productId: string, dto: { rating?: number; title?: string; comment?: string; customerName?: string; customerPhone?: string }) {
    const ownerId = await this.resolveOwner(slugOrDomain);
    const rating = Math.max(1, Math.min(5, Math.round(Number(dto.rating) || 5)));
    return this.reviewsRepo.save(this.reviewsRepo.create({
      ownerId, productId, rating,
      title: dto.title ?? '', comment: dto.comment ?? '',
      customerName: dto.customerName ?? 'Customer', customerPhone: dto.customerPhone ?? null,
      approved: true,
    }));
  }
  /** Owner: list all reviews (for moderation). */
  listOwnerReviews(ownerId: string) {
    return this.reviewsRepo.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 300 });
  }
  async deleteReview(ownerId: string, id: string) {
    await this.reviewsRepo.delete({ ownerId, id });
    return { removed: true };
  }

  /** Resolve a slug or custom domain to the store owner's userId. */
  async resolveOwner(slugOrDomain: string): Promise<string> {
    const settings =
      (await this.settingsRepo.findOne({ where: { domainSlug: slugOrDomain } })) ??
      (await this.settingsRepo.findOne({ where: { customDomain: slugOrDomain } }));
    if (!settings) throw new NotFoundException('Store not found');
    return settings.ownerId;
  }

  // ── Public customer profile + loyalty ───────────────────────────────────

  private normalizePhone(phone: string): string {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length >= 9) return `255${digits.slice(1)}`;
    return digits;
  }

  private async findCustomerByPhone(ownerId: string, phone: string): Promise<LoyaltyCustomer | null> {
    const phoneNormalized = this.normalizePhone(phone);
    if (!phoneNormalized) return null;
    return (
      await this.loyaltyRepo.findOne({ where: { ownerId, phoneNormalized } })
    ) ?? (
      await this.loyaltyRepo.findOne({ where: { ownerId, phone: phone.trim() } })
    );
  }

  private async uniqueLoyaltyCode(): Promise<string> {
    for (let i = 0; i < 12; i += 1) {
      const code = `KJ-${randomBytes(4).toString('hex').toUpperCase()}`;
      if (!(await this.loyaltyRepo.findOne({ where: { loyaltyCode: code } }))) return code;
    }
    throw new BadRequestException('Could not generate a loyalty number; please try again');
  }

  private async uniqueCouponCode(): Promise<string> {
    for (let i = 0; i < 12; i += 1) {
      const code = `KOBE15-${randomBytes(3).toString('hex').toUpperCase()}`;
      if (!(await this.couponsRepo.findOne({ where: { code } }))) return code;
    }
    throw new BadRequestException('Could not generate a signup coupon; please try again');
  }

  private async availableCoupon(customer: LoyaltyCustomer): Promise<string | null> {
    if (!customer.signupCouponCode) return null;
    const coupon = await this.couponsRepo.findOne({
      where: { ownerId: customer.ownerId, code: customer.signupCouponCode, active: true },
    });
    if (!coupon) return null;
    if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) return null;
    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) return null;
    return coupon.code;
  }

  private async publicCustomer(customer: LoyaltyCustomer) {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address || '',
      loyaltyCode: customer.loyaltyCode,
      points: customer.points,
      visits: customer.visits,
      purchaseCount: customer.purchaseCount,
      freeJerseyCredits: customer.freeJerseyCredits,
      couponCode: await this.availableCoupon(customer),
      joinedAt: customer.joinDate || customer.createdAt,
    };
  }

  private async ensureCustomer(ownerId: string, dto: { name: string; phone: string }): Promise<{ customer: LoyaltyCustomer; created: boolean }> {
    const name = dto.name.trim();
    const phone = dto.phone.trim();
    const phoneNormalized = this.normalizePhone(phone);
    if (!name) throw new BadRequestException('Name is required');
    if (phoneNormalized.length < 9) throw new BadRequestException('Enter a valid phone number');

    let customer = await this.findCustomerByPhone(ownerId, phone);
    let created = false;
    if (!customer) {
      created = true;
      customer = this.loyaltyRepo.create({
        ownerId,
        name,
        phone,
        phoneNormalized,
        loyaltyCode: await this.uniqueLoyaltyCode(),
        signupCouponCode: await this.uniqueCouponCode(),
        address: '',
        points: 100,
        visits: 0,
        purchaseCount: 0,
        freeJerseyCredits: 0,
        freeJerseyAwarded: false,
        joinDate: new Date().toISOString().slice(0, 10),
      });
      customer = await this.loyaltyRepo.save(customer);
      await this.couponsRepo.save(this.couponsRepo.create({
        ownerId,
        code: customer.signupCouponCode,
        type: 'Percentage',
        value: 15,
        usageLimit: 1,
        usageCount: 0,
        active: true,
      }));
      await this.loyaltyPointsRepo.save(this.loyaltyPointsRepo.create({
        ownerId,
        customer: customer.name,
        type: 'Bonus',
        points: 100,
        description: 'Storefront signup bonus',
        date: new Date().toISOString().slice(0, 10),
      }));
    } else {
      customer.name = name;
      customer.phone = phone;
      customer.phoneNormalized = phoneNormalized;
      if (!customer.loyaltyCode) customer.loyaltyCode = await this.uniqueLoyaltyCode();
      if (!customer.signupCouponCode) {
        customer.signupCouponCode = await this.uniqueCouponCode();
        await this.couponsRepo.save(this.couponsRepo.create({
          ownerId,
          code: customer.signupCouponCode,
          type: 'Percentage',
          value: 15,
          usageLimit: 1,
          usageCount: 0,
          active: true,
        }));
      }
      customer = await this.loyaltyRepo.save(customer);
    }
    return { customer, created };
  }

  async signupCustomer(slugOrDomain: string, dto: { name: string; phone: string }) {
    const ownerId = await this.resolveOwner(slugOrDomain);
    const { customer, created } = await this.ensureCustomer(ownerId, dto);
    return { ...(await this.publicCustomer(customer)), created };
  }

  async customerProfile(slugOrDomain: string, phone: string) {
    const ownerId = await this.resolveOwner(slugOrDomain);
    const customer = await this.findCustomerByPhone(ownerId, phone);
    if (!customer) throw new NotFoundException('Customer not found');
    return this.publicCustomer(customer);
  }

  async loyaltyByCode(slugOrDomain: string, code: string) {
    const ownerId = await this.resolveOwner(slugOrDomain);
    const customer = await this.loyaltyRepo.findOne({
      where: { ownerId, loyaltyCode: String(code || '').trim().toUpperCase() },
    });
    if (!customer) throw new NotFoundException('Loyalty member not found');
    return this.publicCustomer(customer);
  }

  private isJersey(product: PosProduct): boolean {
    const text = [product.name, product.category, product.brand, ...(product.tags ?? [])]
      .join(' ')
      .toLowerCase();
    return /jersey|shirt|kit|retro|national team|club/.test(text)
      || Object.keys(product.jerseyDetails ?? {}).length > 0;
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
    const customer = dto.customerPhone
      ? await this.findCustomerByPhone(ownerId, dto.customerPhone)
      : null;

    // A welcome coupon is tied to the phone it was issued to. This keeps the
    // automatic code convenient without turning it into a public shared code.
    if (dto.couponCode) {
      const couponOwner = await this.loyaltyRepo.findOne({
        where: { ownerId, signupCouponCode: dto.couponCode.trim().toUpperCase() },
      });
      if (couponOwner && (!customer || couponOwner.id !== customer.id)) {
        throw new BadRequestException('This coupon belongs to another loyalty member');
      }
    }

    // Public storefront requests never get to self-authorize manager pricing.
    // Reward pricing is inserted below only after validating the member credit.
    const safeLines: Array<{ productId: string; quantity: number; negotiatedPrice?: number }> =
      dto.lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));

    // A social-live reservation token is the attribution proof. Resolve every
    // campaign/platform value server-side, verify the token belongs to this
    // shop, and apply the reserved Live price only to its matched product.
    // The rest of the basket stays at normal catalogue pricing but the entire
    // order remains attributable to the Live session that brought the buyer.
    let liveAttribution: {
      comment: LiveComment;
      session: LiveSession;
      pin: LivePin;
      reservedLine: { productId: string; quantity: number; negotiatedPrice?: number };
    } | null = null;
    if (dto.liveCheckoutToken?.trim()) {
      const comment = await this.liveCommentsRepo.findOne({
        where: { ownerId, checkoutToken: dto.liveCheckoutToken.trim() },
      });
      if (!comment) throw new BadRequestException('Live reservation was not found for this store');
      if (comment.status === 'CONVERTED') throw new BadRequestException('This Live reservation has already been used');
      if (comment.status !== 'RESERVED' || !comment.reservedUntil || comment.reservedUntil.getTime() <= Date.now()) {
        throw new BadRequestException('This Live reservation has expired');
      }
      if (!comment.matchedProductId) throw new BadRequestException('Live reservation has no matched product');
      const [session, pin, product] = await Promise.all([
        this.liveSessionsRepo.findOne({ where: { ownerId, id: comment.sessionId } }),
        this.livePinsRepo.findOne({
          where: { ownerId, sessionId: comment.sessionId, productId: comment.matchedProductId },
        }),
        this.productsRepo.findOne({ where: { ownerId, id: comment.matchedProductId, active: true } }),
      ]);
      if (!session || !pin || !product) throw new BadRequestException('Live product is no longer available');
      const reservedLine = safeLines.find((line) => line.productId === comment.matchedProductId);
      if (!reservedLine || Number(reservedLine.quantity) < Number(comment.qty || 1)) {
        throw new BadRequestException(`Keep at least ${Number(comment.qty || 1)} of the reserved Live item in your cart`);
      }
      const livePrice = Number(pin.livePrice || 0);
      const catalogPrice = Number(product.price || 0);
      if (livePrice > 0 && livePrice <= catalogPrice) reservedLine.negotiatedPrice = livePrice;
      liveAttribution = { comment, session, pin, reservedLine };
    }
    let rewardClaimed = false;
    const rewardProductId = dto.redeemFreeJerseyProductId;
    if (rewardProductId) {
      if (!customer || !dto.loyaltyCode || customer.loyaltyCode !== dto.loyaltyCode.trim().toUpperCase()) {
        throw new BadRequestException('A valid loyalty membership is required for this reward');
      }
      const rewardLine = safeLines.find((line) => line.productId === rewardProductId);
      if (!rewardLine || Number(rewardLine.quantity) < 1) {
        throw new BadRequestException('Add the reward jersey to your cart first');
      }
      const product = await this.productsRepo.findOne({ where: { ownerId, id: rewardProductId, active: true } });
      if (!product || !this.isJersey(product)) {
        throw new BadRequestException('The free-jersey reward can only be used on an eligible jersey');
      }
      const claim = await this.loyaltyRepo.createQueryBuilder()
        .update(LoyaltyCustomer)
        .set({ freeJerseyCredits: () => '"freeJerseyCredits" - 1' })
        .where('id = :id AND "ownerId" = :ownerId AND "freeJerseyCredits" > 0', { id: customer.id, ownerId })
        .execute();
      if (!claim.affected) throw new BadRequestException('No free-jersey credit is available');
      rewardClaimed = true;

      // Exactly one unit is free. If the cart has multiple units of the same
      // jersey, split the line so the remainder stays at normal price.
      const index = safeLines.indexOf(rewardLine);
      const replacement: Array<{ productId: string; quantity: number; negotiatedPrice?: number }> = [
        { productId: rewardProductId, quantity: 1, negotiatedPrice: 0 },
      ];
      if (Number(rewardLine.quantity) > 1) {
        replacement.push({
          productId: rewardProductId,
          quantity: Number(rewardLine.quantity) - 1,
          negotiatedPrice: rewardLine.negotiatedPrice,
        });
      }
      safeLines.splice(index, 1, ...replacement);
    }

    const publicDto = {
      orderNumber: dto.orderNumber,
      lines: safeLines,
      paymentMethod: dto.paymentMethod,
      couponCode: dto.couponCode?.trim().toUpperCase() || undefined,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      salesChannel: liveAttribution
        ? `${liveAttribution.session.platform}-${liveAttribution.session.kind}`
        : 'storefront',
      liveSessionId: liveAttribution?.session.id,
      liveCommentId: liveAttribution?.comment.id,
      attributionCode: liveAttribution?.comment.reservationCode || undefined,
      installmentMonths: dto.installmentMonths,
      approvedBy: rewardClaimed ? `LOYALTY-${customer!.loyaltyCode}` : undefined,
    } as CreateOrderDto;

    let sale: Awaited<ReturnType<OrdersService['create']>>;
    try {
      sale = await this.orders.create(ownerId, publicDto);
    } catch (error) {
      if (rewardClaimed && customer) {
        await this.loyaltyRepo.increment({ id: customer.id, ownerId }, 'freeJerseyCredits', 1);
      }
      throw error;
    }

    // Convert the reservation only after the full POS transaction commits.
    // The session receives the whole basket value—not just the first reserved
    // product—because the Live is what acquired this customer and sale.
    if (liveAttribution) {
      const { comment, session, pin, reservedLine } = liveAttribution;
      comment.status = 'CONVERTED';
      comment.orderId = (sale as { id: string }).id;
      comment.qty = Number(reservedLine.quantity);
      comment.buyerContact = dto.customerPhone?.trim() || comment.buyerContact;
      pin.soldQty = Number(pin.soldQty || 0) + Number(reservedLine.quantity);
      session.totalSales = Number(session.totalSales || 0) + Number((sale as { total: number }).total || 0);
      session.orderCount = Number(session.orderCount || 0) + 1;
      await Promise.all([
        this.liveCommentsRepo.save(comment),
        this.livePinsRepo.save(pin),
        this.liveSessionsRepo.save(session),
      ]);
    }

    let loyalty: Awaited<ReturnType<StoreService['publicCustomer']>> | null = null;
    if (dto.customerPhone && dto.customerName) {
      const ensured = await this.ensureCustomer(ownerId, { name: dto.customerName, phone: dto.customerPhone });
      const fresh = await this.loyaltyRepo.findOneOrFail({ where: { id: ensured.customer.id, ownerId } });
      fresh.address = dto.customerAddress?.trim() || fresh.address || '';
      fresh.visits += 1;
      fresh.purchaseCount += 1;
      fresh.lastOrderId = (sale as { id: string }).id;
      const earned = Math.max(0, Math.floor(Number((sale as { total: number }).total || 0) / 1000));
      fresh.points += earned;
      if (!fresh.freeJerseyAwarded) {
        fresh.freeJerseyAwarded = true;
        fresh.freeJerseyCredits += 1;
      }
      const saved = await this.loyaltyRepo.save(fresh);
      if (earned > 0) {
        await this.loyaltyPointsRepo.save(this.loyaltyPointsRepo.create({
          ownerId,
          customer: saved.name,
          type: 'Earned',
          points: earned,
          description: `Purchase ${(sale as { orderNumber: string }).orderNumber}`,
          date: new Date().toISOString().slice(0, 10),
        }));
      }
      loyalty = await this.publicCustomer(saved);
    }

    return {
      ...sale,
      loyalty,
      rewardRedeemed: rewardClaimed,
      attribution: liveAttribution ? {
        channel: `${liveAttribution.session.platform}-${liveAttribution.session.kind}`,
        sessionId: liveAttribution.session.id,
        sessionTitle: liveAttribution.session.title,
        reservationCode: liveAttribution.comment.reservationCode,
      } : null,
    };
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

    // With wildcard DNS every <slug>.kobeapptz.com reaches the backend, so
    // we must gate visibility here. An unpublished store stays invisible
    // to public visitors even though the subdomain technically resolves.
    if (!settings.isPublished) {
      throw new NotFoundException('Store not found');
    }

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
