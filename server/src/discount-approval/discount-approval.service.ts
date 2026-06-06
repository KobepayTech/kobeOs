import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import {
  DiscountRequest,
  DiscountLog,
  DiscountApprovalRule,
  DiscountRequestStatus,
} from './discount-approval.entity';
import { PosProduct } from '../pos/pos.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ApproveDiscountRequestDto,
  CompleteDiscountSaleDto,
  CounterDiscountRequestDto,
  CreateApprovalRuleDto,
  CreateDiscountRequestDto,
  ListRequestsQueryDto,
  RejectDiscountRequestDto,
  UpdateApprovalRuleDto,
  computeDiscountCalcs,
} from './dto/discount-approval.dto';

const DEFAULT_EXPIRY_MINUTES = 5;

@Injectable()
export class DiscountApprovalService {
  private readonly logger = new Logger(DiscountApprovalService.name);

  constructor(
    @InjectRepository(DiscountRequest)
    private readonly requests: Repository<DiscountRequest>,
    @InjectRepository(DiscountLog)
    private readonly logs: Repository<DiscountLog>,
    @InjectRepository(DiscountApprovalRule)
    private readonly rules: Repository<DiscountApprovalRule>,
    @InjectRepository(PosProduct)
    private readonly products: Repository<PosProduct>,
    private readonly ds: DataSource,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private n(v: unknown): number { return Number(v ?? 0); }

  private expiryDate(minutes: number): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private async getRequest(ownerId: string, id: string): Promise<DiscountRequest> {
    const req = await this.requests.findOne({ where: { id, ownerId } });
    if (!req) throw new NotFoundException('Discount request not found');
    return req;
  }

  private assertStatus(req: DiscountRequest, ...allowed: DiscountRequestStatus[]): void {
    if (!allowed.includes(req.status)) {
      throw new BadRequestException(
        `Cannot perform this action on a request with status "${req.status}"`,
      );
    }
  }

  // ── Auto-approval rule engine ──────────────────────────────────────────────

  /**
   * Evaluates active rules in priority order.
   * Returns true if any rule matches all its conditions → auto-approve.
   */
  private async checkAutoApproval(
    ownerId: string,
    discountPercent: number,
    actualMarginPercent: number,
    quantity: number,
  ): Promise<boolean> {
    const activeRules = await this.rules.find({
      where: { ownerId, isActive: true },
      order: { priority: 'ASC' },
    });

    for (const rule of activeRules) {
      const maxDisc   = this.n(rule.maxDiscountPercent);
      const minMargin = this.n(rule.minMarginPercent);
      const minQty    = rule.minQuantity ?? 0;

      if (rule.maxDiscountPercent !== null && discountPercent > maxDisc) continue;
      if (rule.minMarginPercent   !== null && actualMarginPercent < minMargin) continue;
      if (rule.minQuantity        !== null && quantity < minQty) continue;
      // Customer tier and seller role checks would require passing those values —
      // skipped here as they require user profile data not yet in scope.
      return true; // all conditions matched
    }
    return false;
  }

  // ── Create request (seller) ────────────────────────────────────────────────

  async createRequest(ownerId: string, sellerId: string, dto: CreateDiscountRequestDto): Promise<DiscountRequest> {
    // Validate product belongs to this owner
    const product = await this.products.findOne({ where: { id: dto.productId, ownerId } });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.active) throw new BadRequestException('Product is not active');

    // Validate price
    if (dto.requestedPrice > dto.standardPrice) {
      throw new BadRequestException('Requested price cannot exceed standard price');
    }
    if (dto.requestedPrice <= 0) {
      throw new BadRequestException('Requested price must be greater than zero');
    }

    // Validate stock (available = stock - reservedStock)
    const available = this.n(product.stock) - this.n(product.reservedStock);
    if (dto.quantity > available) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${available}, requested: ${dto.quantity}`,
      );
    }

    const unitCost = this.n(dto.unitCost ?? 0);
    const calcs = computeDiscountCalcs(dto.standardPrice, dto.requestedPrice, unitCost, dto.quantity);

    // Check auto-approval rules
    const autoApprove = await this.checkAutoApproval(
      ownerId,
      calcs.discountPercent,
      calcs.newMarginPercent,
      dto.quantity,
    );

    const expiryMinutes = DEFAULT_EXPIRY_MINUTES;
    const status: DiscountRequestStatus = autoApprove ? 'APPROVED' : 'PENDING';

    // Reserve stock
    product.reservedStock = this.n(product.reservedStock) + dto.quantity;
    await this.products.save(product);

    const req = this.requests.create({
      ownerId,
      sellerId,
      sellerName: dto.sellerName ?? null,
      productId: dto.productId,
      productName: dto.productName ?? product.name,
      variantId: dto.variantId ?? null,
      customerId: dto.customerId ?? null,
      customerName: dto.customerName ?? null,
      quantity: dto.quantity,
      standardPrice: dto.standardPrice,
      unitCost,
      requestedPrice: dto.requestedPrice,
      approvedPrice: autoApprove ? dto.requestedPrice : null,
      currency: dto.currency ?? 'TZS',
      reason: dto.reason ?? null,
      photoUrl: dto.photoUrl ?? null,
      status,
      expiresAt: autoApprove ? null : this.expiryDate(expiryMinutes),
      idempotencyKey: randomUUID(),
    });

    const saved = await this.requests.save(req);

    await this.audit.log({
      action: 'CREATE',
      entityType: 'DiscountRequest',
      entityId: saved.id,
      userId: sellerId,
      newValue: { status, autoApprove, discountPercent: calcs.discountPercent } as any,
    });

    if (status === 'PENDING') {
      await this.notifyOwner(ownerId, saved);
    }

    return saved;
  }

  // ── Approve (owner) ────────────────────────────────────────────────────────

  async approveRequest(
    ownerId: string,
    approverId: string,
    id: string,
    dto: ApproveDiscountRequestDto,
  ): Promise<DiscountRequest> {
    const req = await this.getRequest(ownerId, id);
    this.assertStatus(req, 'PENDING', 'COUNTERED');

    if (req.sellerId === approverId) {
      throw new ForbiddenException('Seller cannot approve their own discount request');
    }
    if (req.expiresAt && req.expiresAt < new Date()) {
      throw new BadRequestException('This request has expired');
    }

    return this.ds.transaction(async (tx) => {
      const reqRepo     = tx.getRepository(DiscountRequest);
      const productRepo = tx.getRepository(PosProduct);

      // Lock the request row
      const locked = await reqRepo.findOne({ where: { id, ownerId }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw new NotFoundException('Request not found');
      if (!['PENDING', 'COUNTERED'].includes(locked.status)) {
        throw new ConflictException('Request status changed — please refresh');
      }

      // Lock and verify stock
      const product = await productRepo.findOne({
        where: { id: locked.productId, ownerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');

      const available = this.n(product.stock) - this.n(product.reservedStock) + locked.quantity;
      if (locked.quantity > available) {
        throw new BadRequestException('Insufficient stock to complete this sale');
      }

      // Complete the sale inline
      const completed = await this.completeSaleInTransaction(tx, ownerId, locked, dto.approvedPrice, approverId, dto.note ?? null, 'cash');

      await this.audit.log({
        action: 'UPDATE',
        entityType: 'DiscountRequest',
        entityId: id,
        userId: approverId,
        newValue: { status: 'COMPLETED', approvedPrice: dto.approvedPrice } as any,
      });

      await this.notifySeller(locked, 'approved');
      return completed;
    });
  }

  // ── Counter offer (owner) ──────────────────────────────────────────────────

  async counterRequest(
    ownerId: string,
    approverId: string,
    id: string,
    dto: CounterDiscountRequestDto,
  ): Promise<DiscountRequest> {
    const req = await this.getRequest(ownerId, id);
    this.assertStatus(req, 'PENDING');

    if (req.sellerId === approverId) {
      throw new ForbiddenException('Seller cannot counter their own request');
    }
    if (req.expiresAt && req.expiresAt < new Date()) {
      throw new BadRequestException('This request has expired');
    }
    if (dto.counterPrice > this.n(req.standardPrice)) {
      throw new BadRequestException('Counter price cannot exceed standard price');
    }

    req.status       = 'COUNTERED';
    req.counterPrice = dto.counterPrice;
    req.approverId   = approverId;
    req.approverNote = dto.note ?? null;
    req.respondedAt  = new Date();
    req.expiresAt    = this.expiryDate(DEFAULT_EXPIRY_MINUTES); // reset timer

    const saved = await this.requests.save(req);

    await this.audit.log({
      action: 'UPDATE',
      entityType: 'DiscountRequest',
      entityId: id,
      userId: approverId,
      newValue: { status: 'COUNTERED', counterPrice: dto.counterPrice } as any,
    });

    await this.notifySeller(saved, 'countered');
    return saved;
  }

  // ── Reject (owner) ────────────────────────────────────────────────────────

  async rejectRequest(
    ownerId: string,
    approverId: string,
    id: string,
    dto: RejectDiscountRequestDto,
  ): Promise<DiscountRequest> {
    const req = await this.getRequest(ownerId, id);
    this.assertStatus(req, 'PENDING', 'COUNTERED');

    if (req.sellerId === approverId) {
      throw new ForbiddenException('Seller cannot reject their own request');
    }

    req.status       = 'REJECTED';
    req.approverId   = approverId;
    req.approverNote = dto.note ?? null;
    req.respondedAt  = new Date();

    await this.releaseStockReservation(ownerId, req.productId, req.quantity);
    const saved = await this.requests.save(req);

    await this.audit.log({
      action: 'UPDATE',
      entityType: 'DiscountRequest',
      entityId: id,
      userId: approverId,
      newValue: { status: 'REJECTED' } as any,
    });

    await this.notifySeller(saved, 'rejected');
    return saved;
  }

  // ── Seller accepts counter ─────────────────────────────────────────────────

  async acceptCounter(ownerId: string, sellerId: string, id: string): Promise<DiscountRequest> {
    const req = await this.getRequest(ownerId, id);
    this.assertStatus(req, 'COUNTERED');

    if (req.sellerId !== sellerId) {
      throw new ForbiddenException('Only the original seller can accept a counter offer');
    }
    if (req.expiresAt && req.expiresAt < new Date()) {
      throw new BadRequestException('Counter offer has expired');
    }
    if (!req.counterPrice) {
      throw new BadRequestException('No counter price set');
    }

    return this.ds.transaction(async (tx) => {
      const reqRepo = tx.getRepository(DiscountRequest);
      const locked  = await reqRepo.findOne({ where: { id, ownerId }, lock: { mode: 'pessimistic_write' } });
      if (!locked || locked.status !== 'COUNTERED') {
        throw new ConflictException('Request status changed — please refresh');
      }

      const completed = await this.completeSaleInTransaction(
        tx, ownerId, locked, this.n(locked.counterPrice), locked.approverId, null, 'cash',
      );

      await this.audit.log({
        action: 'UPDATE',
        entityType: 'DiscountRequest',
        entityId: id,
        userId: sellerId,
        newValue: { status: 'COMPLETED', via: 'seller_accepted_counter' } as any,
      });

      return completed;
    });
  }

  // ── Seller rejects counter ─────────────────────────────────────────────────

  async rejectCounter(ownerId: string, sellerId: string, id: string): Promise<DiscountRequest> {
    const req = await this.getRequest(ownerId, id);
    this.assertStatus(req, 'COUNTERED');

    if (req.sellerId !== sellerId) {
      throw new ForbiddenException('Only the original seller can reject a counter offer');
    }

    req.status      = 'REJECTED';
    req.respondedAt = new Date();

    await this.releaseStockReservation(ownerId, req.productId, req.quantity);
    const saved = await this.requests.save(req);

    await this.audit.log({
      action: 'UPDATE',
      entityType: 'DiscountRequest',
      entityId: id,
      userId: sellerId,
      newValue: { status: 'REJECTED', via: 'seller_rejected_counter' } as any,
    });

    return saved;
  }

  // ── Complete sale (explicit — seller triggers after approval) ──────────────

  async completeSale(
    ownerId: string,
    sellerId: string,
    id: string,
    dto: CompleteDiscountSaleDto,
  ): Promise<DiscountRequest> {
    const req = await this.getRequest(ownerId, id);
    this.assertStatus(req, 'APPROVED');

    if (req.sellerId !== sellerId) {
      throw new ForbiddenException('Only the original seller can complete this sale');
    }
    if (!req.approvedPrice) {
      throw new BadRequestException('No approved price set');
    }

    return this.ds.transaction(async (tx) => {
      const reqRepo = tx.getRepository(DiscountRequest);
      const locked  = await reqRepo.findOne({ where: { id, ownerId }, lock: { mode: 'pessimistic_write' } });
      if (!locked || locked.status !== 'APPROVED') {
        throw new ConflictException('Request status changed — please refresh');
      }

      return this.completeSaleInTransaction(
        tx, ownerId, locked, this.n(locked.approvedPrice), locked.approverId,
        null, dto.paymentMethod,
      );
    });
  }

  // ── Core sale creation (runs inside a transaction) ─────────────────────────

  private async completeSaleInTransaction(
    tx: any,
    ownerId: string,
    req: DiscountRequest,
    approvedPrice: number,
    approverId: string | null,
    approverNote: string | null,
    paymentMethod: string,
  ): Promise<DiscountRequest> {
    const reqRepo     = tx.getRepository(DiscountRequest);
    const productRepo = tx.getRepository(PosProduct);
    const logRepo     = tx.getRepository(DiscountLog);

    // Idempotency guard — prevent double sale creation
    if (req.saleId) {
      throw new ConflictException('Sale already created for this request');
    }

    // Lock and update product stock
    const product = await productRepo.findOne({
      where: { id: req.productId, ownerId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!product) throw new NotFoundException('Product not found');

    const newStock    = this.n(product.stock) - req.quantity;
    const newReserved = Math.max(0, this.n(product.reservedStock) - req.quantity);
    if (newStock < 0) throw new BadRequestException('Insufficient stock');

    product.stock         = newStock;
    product.reservedStock = newReserved;
    await productRepo.save(product);

    // Create a POS order record for the discounted sale
    const { PosOrder, PosOrderItem } = await import('../pos/pos.entity');
    const orderRepo     = tx.getRepository(PosOrder);
    const orderItemRepo = tx.getRepository(PosOrderItem);

    const orderNumber = `DISC-${Date.now()}`;
    const lineTotal   = approvedPrice * req.quantity;
    const discountAmt = this.n(req.standardPrice) * req.quantity - lineTotal;

    const order = orderRepo.create({
      ownerId,
      orderNumber,
      subtotal:       lineTotal,
      taxAmount:      0,
      discountAmount: discountAmt,
      total:          lineTotal,
      currency:       req.currency,
      status:         'COMPLETED',
      paymentMethod,
      customerName:   req.customerName ?? null,
    });
    const savedOrder = await orderRepo.save(order);

    await orderItemRepo.save(orderItemRepo.create({
      ownerId,
      orderId:     savedOrder.id,
      productId:   req.productId,
      productName: req.productName ?? product.name,
      unitPrice:   approvedPrice,
      quantity:    req.quantity,
      lineTotal,
    }));

    // Write immutable discount log
    const calcs = computeDiscountCalcs(
      this.n(req.standardPrice), approvedPrice, this.n(req.unitCost), req.quantity,
    );
    await logRepo.save(logRepo.create({
      ownerId,
      discountRequestId: req.id,
      saleId:            savedOrder.id,
      productId:         req.productId,
      variantId:         req.variantId,
      customerId:        req.customerId,
      sellerId:          req.sellerId,
      approverId,
      quantity:          req.quantity,
      standardPrice:     this.n(req.standardPrice),
      approvedPrice,
      unitCost:          this.n(req.unitCost),
      standardValue:     calcs.standardTotal,
      actualValue:       calcs.proposedTotal,
      discountAmount:    calcs.discountAmount,
      discountPercent:   calcs.discountPercent,
      standardMargin:    calcs.standardMarginPercent,
      actualMargin:      calcs.newMarginPercent,
      profit:            calcs.profit,
      currency:          req.currency,
    }));

    // Mark request completed
    req.status       = 'COMPLETED';
    req.approvedPrice = approvedPrice;
    req.approverId   = approverId;
    req.approverNote = approverNote;
    req.saleId       = savedOrder.id;
    req.completedAt  = new Date();
    req.respondedAt  = req.respondedAt ?? new Date();

    return reqRepo.save(req);
  }

  // ── Stock helpers ──────────────────────────────────────────────────────────

  private async releaseStockReservation(ownerId: string, productId: string, quantity: number): Promise<void> {
    const product = await this.products.findOne({ where: { id: productId, ownerId } });
    if (!product) return;
    product.reservedStock = Math.max(0, this.n(product.reservedStock) - quantity);
    await this.products.save(product);
  }

  // ── Expiry cron ────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingRequests(): Promise<void> {
    const now = new Date();
    const stale = await this.requests.find({
      where: [
        { status: 'PENDING',   expiresAt: LessThan(now) },
        { status: 'COUNTERED', expiresAt: LessThan(now) },
      ],
    });

    if (stale.length === 0) return;

    for (const req of stale) {
      req.status = 'EXPIRED';
      await this.releaseStockReservation(req.ownerId, req.productId, req.quantity);
      await this.notifySeller(req, 'expired');
    }

    await this.requests.save(stale);
    this.logger.log(`Expired ${stale.length} discount request(s)`);
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  private async notifyOwner(ownerId: string, req: DiscountRequest): Promise<void> {
    try {
      // In-app notification via existing notifications service
      // SMS via Beem for offline owners — only for pending requests (cost control)
      await (this.notifications as any).notifyDiscountRequest?.(ownerId, req);
    } catch (e) {
      this.logger.warn(`Owner notification failed: ${(e as Error).message}`);
    }
  }

  private async notifySeller(req: DiscountRequest, event: 'approved' | 'countered' | 'rejected' | 'expired'): Promise<void> {
    try {
      await (this.notifications as any).notifyDiscountEvent?.(req.sellerId, event, req);
    } catch (e) {
      this.logger.warn(`Seller notification failed: ${(e as Error).message}`);
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  listRequests(ownerId: string, query: ListRequestsQueryDto) {
    const where: Record<string, unknown> = { ownerId };
    if (query.status)    where['status']    = query.status;
    if (query.sellerId)  where['sellerId']  = query.sellerId;
    if (query.productId) where['productId'] = query.productId;
    return this.requests.find({ where: where as any, order: { createdAt: 'DESC' } });
  }

  listPending(ownerId: string) {
    return this.requests.find({
      where: [
        { ownerId, status: 'PENDING' },
        { ownerId, status: 'COUNTERED' },
      ],
      order: { createdAt: 'ASC' }, // oldest first — most urgent
    });
  }

  getRequest$(ownerId: string, id: string) {
    return this.getRequest(ownerId, id);
  }

  listLogs(ownerId: string) {
    return this.logs.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Aggregated discount report. Returns the headline totals, per-seller and
   * per-product breakdowns, and the margin impact summary the dashboard
   * spec asks for ("Profit Lost to Discounts: 14.5%").
   *
   * Defaults to the current calendar month when from/to are unset.
   */
  async getReport(ownerId: string, fromIso?: string, toIso?: string) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const from = fromIso ? new Date(fromIso) : defaultFrom;
    const to = toIso ? new Date(toIso) : defaultTo;

    const rows = await this.logs
      .createQueryBuilder('l')
      .where('l."ownerId" = :ownerId', { ownerId })
      .andWhere('l."createdAt" BETWEEN :from AND :to', { from: from.toISOString(), to: to.toISOString() })
      .getMany();

    let standardValue = 0;
    let actualValue = 0;
    let discountAmount = 0;
    let profit = 0;
    const bySeller = new Map<string, { discount: number; actual: number; count: number }>();
    const byProduct = new Map<string, { discount: number; actual: number; quantity: number; avgPct: number; sumPct: number; n: number }>();

    for (const r of rows) {
      standardValue += Number(r.standardValue);
      actualValue += Number(r.actualValue);
      discountAmount += Number(r.discountAmount);
      profit += Number(r.profit);

      const sellerKey = r.sellerId;
      const sb = bySeller.get(sellerKey) ?? { discount: 0, actual: 0, count: 0 };
      sb.discount += Number(r.discountAmount);
      sb.actual += Number(r.actualValue);
      sb.count += 1;
      bySeller.set(sellerKey, sb);

      const productKey = r.productId;
      const pb = byProduct.get(productKey) ?? { discount: 0, actual: 0, quantity: 0, avgPct: 0, sumPct: 0, n: 0 };
      pb.discount += Number(r.discountAmount);
      pb.actual += Number(r.actualValue);
      pb.quantity += Number(r.quantity);
      pb.sumPct += Number(r.discountPercent);
      pb.n += 1;
      pb.avgPct = pb.sumPct / pb.n;
      byProduct.set(productKey, pb);
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        approvedRequests: rows.length,
        standardValue,
        actualValue,
        discountAmount,
        discountRate: standardValue > 0 ? (discountAmount / standardValue) * 100 : 0,
        profit,
        // Margin impact: potential profit if every sale had been at standard price.
        // potentialProfit = profit + discountAmount (the discount was direct margin lost).
        potentialProfit: profit + discountAmount,
        profitLostPct: profit + discountAmount > 0 ? (discountAmount / (profit + discountAmount)) * 100 : 0,
      },
      bySeller: Array.from(bySeller.entries())
        .map(([sellerId, s]) => ({
          sellerId,
          discountAmount: s.discount,
          actualValue: s.actual,
          requests: s.count,
          discountRate: s.actual > 0 ? (s.discount / (s.discount + s.actual)) * 100 : 0,
        }))
        .sort((a, b) => b.discountAmount - a.discountAmount),
      byProduct: Array.from(byProduct.entries())
        .map(([productId, p]) => ({
          productId,
          discountAmount: p.discount,
          actualValue: p.actual,
          quantity: p.quantity,
          avgDiscountPercent: p.avgPct,
        }))
        .sort((a, b) => b.discountAmount - a.discountAmount)
        .slice(0, 25),
    };
  }

  // ── Rule management ────────────────────────────────────────────────────────

  listRules(ownerId: string) {
    return this.rules.find({ where: { ownerId }, order: { priority: 'ASC' } });
  }

  createRule(ownerId: string, dto: CreateApprovalRuleDto) {
    const rule = this.rules.create({ ...dto, ownerId });
    return this.rules.save(rule);
  }

  async updateRule(ownerId: string, id: string, dto: UpdateApprovalRuleDto) {
    const rule = await this.rules.findOne({ where: { id, ownerId } });
    if (!rule) throw new NotFoundException('Rule not found');
    Object.assign(rule, dto);
    return this.rules.save(rule);
  }

  async deleteRule(ownerId: string, id: string) {
    const rule = await this.rules.findOne({ where: { id, ownerId } });
    if (!rule) throw new NotFoundException('Rule not found');
    await this.rules.remove(rule);
    return { id };
  }
}
