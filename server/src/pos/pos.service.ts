import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PosOrder, PosOrderItem, PosProduct } from './pos.entity';
import { CreateOrderDto, CreateProductDto, UpdateOrderDto, UpdateProductDto } from './dto/pos.dto';
import { ReceiptService } from './receipt.service';
import { PickTicketService } from '../warehouse/pick-ticket.service';
import { DiscountEngine } from '../discounts/discount-engine.service';
import { CreditService } from '../credit/credit.service';
import { JournalService } from '../erp/journal.service';
import { PosGateway } from './pos.gateway';

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(PosProduct) private readonly repo: Repository<PosProduct>) {}

  list(uid: string, page = 1, limit = 50) {
    return this.repo.find({ where: { ownerId: uid }, order: { name: 'ASC' }, skip: (page - 1) * limit, take: limit });
  }

  async get(uid: string, id: string) {
    const item = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!item) throw new NotFoundException();
    return item;
  }

  create(uid: string, dto: CreateProductDto) {
    return this.repo.save(this.repo.create({ ...dto, ownerId: uid }));
  }

  /**
   * Seed a set of placeholder jersey products so an empty storefront isn't
   * blank. All are clearly demo (SKU DEMO-*) and meant to be edited/replaced.
   * Idempotent: skips any DEMO sku that already exists.
   */
  async seedDemo(uid: string) {
    const cat = { CLUB: 'Club Jerseys', NAT: 'National Teams', KIDS: 'Kids', RETRO: 'Retro', TRAIN: 'Training' };
    const demo: Array<{ sku: string; name: string; category: string; price: number; compareAtPrice?: number; stock: number }> = [
      { sku: 'DEMO-001', name: 'Home Jersey — Red Club 2025/26', category: cat.CLUB, price: 65000, compareAtPrice: 85000, stock: 40 },
      { sku: 'DEMO-002', name: 'Away Jersey — Blue Club 2025/26', category: cat.CLUB, price: 65000, compareAtPrice: 85000, stock: 35 },
      { sku: 'DEMO-003', name: 'Third Kit — City Club 2025/26', category: cat.CLUB, price: 70000, stock: 25 },
      { sku: 'DEMO-004', name: 'Home Jersey — White Club 2025/26', category: cat.CLUB, price: 68000, stock: 30 },
      { sku: 'DEMO-005', name: 'Home Jersey — Reds 2025/26', category: cat.CLUB, price: 65000, compareAtPrice: 80000, stock: 28 },
      { sku: 'DEMO-006', name: 'Away Jersey — Paris 2025/26', category: cat.CLUB, price: 72000, stock: 22 },
      { sku: 'DEMO-007', name: 'National Team Home Kit — Yellow', category: cat.NAT, price: 60000, stock: 50 },
      { sku: 'DEMO-008', name: 'National Team Home Kit — Sky Blue', category: cat.NAT, price: 60000, compareAtPrice: 75000, stock: 45 },
      { sku: 'DEMO-009', name: 'National Team Home Kit — Green', category: cat.NAT, price: 58000, stock: 60 },
      { sku: 'DEMO-010', name: 'National Team Away Kit — Red', category: cat.NAT, price: 58000, stock: 40 },
      { sku: 'DEMO-011', name: 'Kids Home Jersey — Red Club', category: cat.KIDS, price: 40000, stock: 30 },
      { sku: 'DEMO-012', name: 'Kids Home Jersey — Blue Club', category: cat.KIDS, price: 40000, compareAtPrice: 52000, stock: 26 },
      { sku: 'DEMO-013', name: 'Kids National Team Kit — Yellow', category: cat.KIDS, price: 38000, stock: 33 },
      { sku: 'DEMO-014', name: 'Retro Jersey — Classic Red 1998', category: cat.RETRO, price: 75000, stock: 15 },
      { sku: 'DEMO-015', name: 'Retro Jersey — Classic Blue 2005', category: cat.RETRO, price: 75000, compareAtPrice: 95000, stock: 12 },
      { sku: 'DEMO-016', name: 'Retro National Kit — 1994', category: cat.RETRO, price: 78000, stock: 10 },
      { sku: 'DEMO-017', name: 'Training Jersey — Black', category: cat.TRAIN, price: 45000, stock: 55 },
      { sku: 'DEMO-018', name: 'Training Jersey — Navy', category: cat.TRAIN, price: 45000, stock: 48 },
      { sku: 'DEMO-019', name: 'Goalkeeper Jersey — Green', category: cat.CLUB, price: 62000, stock: 18 },
      { sku: 'DEMO-020', name: 'Long-Sleeve Home Jersey — Red Club', category: cat.CLUB, price: 70000, compareAtPrice: 88000, stock: 20 },
    ];
    let created = 0;
    for (const d of demo) {
      const exists = await this.repo.findOne({ where: { ownerId: uid, sku: d.sku } });
      if (exists) continue;
      await this.repo.save(this.repo.create({
        ownerId: uid, currency: 'TZS', unit: 'piece',
        description: 'Sample product — edit or replace with your own.',
        ...d,
      }));
      created += 1;
    }
    return { created, total: demo.length };
  }

  async update(uid: string, id: string, dto: UpdateProductDto) {
    const item = await this.get(uid, id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(uid: string, id: string) {
    const item = await this.get(uid, id);
    await this.repo.remove(item);
    return { id };
  }
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(PosOrder) private readonly orders: Repository<PosOrder>,
    @InjectRepository(PosOrderItem) private readonly items: Repository<PosOrderItem>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    private readonly ds: DataSource,
    private readonly receipts: ReceiptService,
    private readonly pickTickets: PickTicketService,
    private readonly discountEngine: DiscountEngine,
    private readonly credit: CreditService,
    private readonly journal: JournalService,
    private readonly gateway: PosGateway,
  ) {}

  list(uid: string, page = 1, limit = 50) {
    return this.orders.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
  }

  async get(uid: string, id: string) {
    const order = await this.orders.findOne({ where: { id, ownerId: uid } });
    if (!order) throw new NotFoundException();
    const items = await this.items.find({ where: { orderId: id, ownerId: uid } });
    return { ...order, items };
  }

  async create(uid: string, dto: CreateOrderDto) {
    if (!dto.lines.length) throw new BadRequestException('Order has no lines');
    const result = await this.ds.transaction(async (tx) => {
      const productRepo = tx.getRepository(PosProduct);
      const orderRepo = tx.getRepository(PosOrder);
      const itemRepo = tx.getRepository(PosOrderItem);

      let subtotal = 0;
      const itemsToInsert: PosOrderItem[] = [];
      const pickLines: { sku: string; name: string; quantity: number }[] = [];

      // Sum of per-line manager-negotiated discounts. Tracked separately
      // from the order-level discountAmount so backend has the per-line
      // attribution downstream reports (commission, loyalty, margin) need.
      // Kept in catalog-price terms so subtotal stays = sum(catalog*qty)
      // and the order-level discount cleanly equals negotiated + coupon.
      let negotiatedDiscount = 0;

      for (const line of dto.lines) {
        const product = await productRepo.findOne({ where: { id: line.productId, ownerId: uid } });
        if (!product) throw new NotFoundException(`Product ${line.productId} not found`);
        // TypeORM returns decimal columns as strings — parse before use.
        const productPrice = parseFloat(product.price as unknown as string);

        // Per-line negotiated price: must be ≥ 0 and never above catalog
        // price (a "negotiated" price higher than catalog would be a
        // markup masquerading as a discount — reject so commission /
        // margin calculations stay honest).
        if (line.negotiatedPrice !== undefined && line.negotiatedPrice !== null) {
          const np = Number(line.negotiatedPrice);
          if (!Number.isFinite(np) || np < 0) {
            throw new BadRequestException(`Invalid negotiatedPrice on ${product.name}`);
          }
          if (np > productPrice + 1e-6) {
            throw new BadRequestException(
              `negotiatedPrice ${np} exceeds catalog price ${productPrice} for ${product.name}`,
            );
          }
          const lineDiscount = parseFloat(((productPrice - np) * line.quantity).toFixed(4));
          if (lineDiscount > 0) negotiatedDiscount = parseFloat((negotiatedDiscount + lineDiscount).toFixed(4));
        }

        // Atomic stock decrement: UPDATE … SET stock = stock - :qty WHERE id
        // = :id AND ownerId = :uid AND stock >= :qty. If no rows are
        // affected we know either the product moved out of this owner or
        // another concurrent order beat us to the last units; either way
        // it's an oversell, not a silent success.
        const decrement = await productRepo
          .createQueryBuilder()
          .update(PosProduct)
          .set({ stock: () => `stock - ${line.quantity}` })
          .where('id = :id AND "ownerId" = :uid AND stock >= :qty', {
            id: product.id, uid, qty: line.quantity,
          })
          .execute();
        if (decrement.affected === 0) {
          throw new BadRequestException(`Insufficient stock for ${product.name}`);
        }

        // lineTotal stays = catalog price × qty so subtotal is gross of
        // negotiated discount; the discount is recognised in the
        // order-level discountAmount below (and per-item via the
        // stored negotiatedPrice column).
        const lineTotal = parseFloat((productPrice * line.quantity).toFixed(4));
        subtotal = parseFloat((subtotal + lineTotal).toFixed(4));
        itemsToInsert.push(
          itemRepo.create({
            ownerId: uid,
            productId: product.id,
            productName: product.name,
            unitPrice: product.price,
            quantity: line.quantity,
            unit: product.unit || 'piece',
            lineTotal,
            negotiatedPrice: line.negotiatedPrice ?? null,
          }),
        );
        pickLines.push({ sku: product.sku, name: product.name, quantity: line.quantity });
      }

      const tax = dto.taxAmount ?? 0;

      const discountResult = await this.discountEngine.apply(uid, {
        subtotal,
        customerScope: dto.customerScope,
        couponCode: dto.couponCode,
        approvedBy: dto.approvedBy,
      });
      if (discountResult.requiresApproval) {
        throw new ForbiddenException(
          'Discount exceeds approval threshold; manager approval required (set approvedBy)',
        );
      }
      // Manager-negotiated per-line discounts stack ON TOP of any
      // coupon/rule discount the engine applied. When neither the engine
      // nor coupon fired, honour the legacy aggregate dto.discountAmount
      // BUT pick whichever is larger between it and the computed
      // per-line discount so the receipt total can never be wrong.
      const couponOrRuleDiscount =
        discountResult.discountAmount > 0 || dto.couponCode
          ? discountResult.discountAmount
          : 0;
      const manualOverride = couponOrRuleDiscount > 0 ? 0 : (dto.discountAmount ?? 0);
      const discount = parseFloat(
        (couponOrRuleDiscount + negotiatedDiscount + Math.max(0, manualOverride - negotiatedDiscount)).toFixed(4),
      );

      const total = parseFloat((subtotal + tax - discount).toFixed(4));
      const paymentMethod = dto.paymentMethod ?? 'CASH';
      const isBnpl = paymentMethod === 'BNPL';

      const order = await orderRepo.save(
        orderRepo.create({
          ownerId: uid,
          orderNumber: dto.orderNumber,
          subtotal,
          taxAmount: tax,
          discountAmount: discount,
          total,
          paymentMethod,
          customerName: dto.customerName ?? null,
          customerPhone: dto.customerPhone ?? null,
          isBnpl,
          status: 'COMPLETED',
        }),
      );

      for (const item of itemsToInsert) item.orderId = order.id;
      await itemRepo.save(itemsToInsert);

      if (discountResult.appliedCouponId) {
        await this.discountEngine.consumeCoupon(tx, discountResult.appliedCouponId);
      }

      let receivable: unknown = null;
      let bnplSchedule: Array<{ amountDue: number; dueDate: Date }> | undefined;
      if (isBnpl) {
        const approval = await this.credit.approveAndReserveInTransaction(tx, uid, {
          customerPhone: dto.customerPhone ?? '',
          customerName: dto.customerName ?? null,
          amount: total,
          installmentMonths: dto.installmentMonths,
          orderId: order.id,
          currency: order.currency,
        });
        order.receivableId = approval.receivable.id;
        await orderRepo.save(order);
        receivable = approval.receivable;
        bnplSchedule = approval.schedule;
      }

      const pickTicket = await this.pickTickets.createInTransaction(tx, uid, {
        ticketNumber: `PT-${order.orderNumber}`,
        orderId: order.id,
        customerName: order.customerName,
        lines: pickLines,
      });

      // Auto-post the journal entry. Cash sales debit Cash; BNPL sales
      // debit Accounts Receivable. Failing here rolls back the whole sale
      // so the books are never left in a half-written state.
      const journal = await this.journal.postPosSaleInTransaction(tx, uid, order, itemsToInsert, { isBnpl });

      const receipt = this.receipts.format(order, itemsToInsert, { schedule: bnplSchedule });

      return {
        ...order,
        items: itemsToInsert,
        receipt,
        pickTicket,
        discount: discountResult,
        receivable,
        journal,
      };
    });

    // Broadcast to the KDS (TV display + mobile prepare screen). Done
    // AFTER the transaction commits so a rollback never fires a
    // phantom "new order" event.
    try {
      this.gateway.emitOrder(uid, result as PosOrder, result.items, 'created');
    } catch (err) {
      // Never let a socket failure poison a real sale.
      // (gateway logs its own errors; we just swallow here.)
      void err;
    }

    return result;
  }

  async update(uid: string, id: string, dto: UpdateOrderDto) {
    const order = await this.orders.findOne({ where: { id, ownerId: uid } });
    if (!order) throw new NotFoundException();

    if (dto.status === 'CANCELLED' && order.status !== 'CANCELLED') {
      await this.ds.transaction(async (tx) => {
        const productRepo = tx.getRepository(PosProduct);
        const itemRepo = tx.getRepository(PosOrderItem);
        const orderItems = await itemRepo.find({ where: { orderId: id, ownerId: uid } });
        for (const item of orderItems) {
          const product = await productRepo.findOne({ where: { id: item.productId, ownerId: uid } });
          if (product) {
            product.stock += item.quantity;
            await productRepo.save(product);
          }
        }
      });
    }

    Object.assign(order, dto);
    return this.orders.save(order);
  }

  // ── Fulfillment workflow (Kitchen Display System) ───────────────────────

  /** Active orders for the TV display + mobile prepare screen. Excludes
   *  COLLECTED so the TV doesn't grow forever; COLLECTED orders fall off
   *  the screen on their next status broadcast. */
  async listForKds(uid: string): Promise<Array<PosOrder & { items: PosOrderItem[] }>> {
    const orders = await this.orders.find({
      where: { ownerId: uid },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    const active = orders.filter((o) => o.fulfillmentStatus !== 'COLLECTED');
    if (active.length === 0) return [];
    const items = await this.items.find({ where: { ownerId: uid } });
    const byOrder = new Map<string, PosOrderItem[]>();
    for (const it of items) {
      const arr = byOrder.get(it.orderId) ?? [];
      arr.push(it);
      byOrder.set(it.orderId, arr);
    }
    return active.map((o) => Object.assign(o, { items: byOrder.get(o.id) ?? [] }));
  }

  /** State-machine transitions. Idempotent (option (a) from the design
   *  conversation): if the order is already in the target state or a
   *  later one, return the current state silently — staff can tap the
   *  same button twice without an error toast, and concurrent taps from
   *  two phones both succeed cleanly. */
  markPreparing(uid: string, id: string) {
    return this.transitionFulfillment(uid, id, 'PREPARING');
  }
  markReady(uid: string, id: string) {
    return this.transitionFulfillment(uid, id, 'READY');
  }
  markCollected(uid: string, id: string) {
    return this.transitionFulfillment(uid, id, 'COLLECTED');
  }

  private async transitionFulfillment(
    uid: string,
    id: string,
    target: PosOrder['fulfillmentStatus'],
  ): Promise<PosOrder & { items: PosOrderItem[] }> {
    const order = await this.orders.findOne({ where: { id, ownerId: uid } });
    if (!order) throw new NotFoundException();
    const items = await this.items.find({ where: { orderId: id, ownerId: uid } });
    const previous = order.fulfillmentStatus;
    const rank: Record<PosOrder['fulfillmentStatus'], number> = {
      NEW: 0, PREPARING: 1, READY: 2, COLLECTED: 3,
    };
    if (rank[previous] >= rank[target]) {
      // Idempotent: silently succeed without re-emitting.
      return Object.assign(order, { items });
    }
    order.fulfillmentStatus = target;
    if (target === 'PREPARING' && !order.preparingAt) order.preparingAt = new Date();
    if (target === 'READY'     && !order.readyAt)     order.readyAt     = new Date();
    if (target === 'COLLECTED' && !order.collectedAt) order.collectedAt = new Date();
    await this.orders.save(order);
    try {
      this.gateway.emitOrder(uid, order, items, 'status', previous);
    } catch (err) { void err; }
    return Object.assign(order, { items });
  }
}
