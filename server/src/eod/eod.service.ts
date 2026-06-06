import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { EXPENSE_CATEGORY_LABELS, ExpenseCategory, ShopCashCount, ShopExpense } from './eod.entity';
import { PosOrder } from '../pos/pos.entity';
import { ShopsService } from '../shops/shops.service';

interface CreateExpenseDto {
  shopId: string;
  amount: number;
  currency?: string;
  category?: ExpenseCategory;
  description?: string;
  receiptUrl?: string | null;
  paidVia?: ShopExpense['paidVia'];
}

interface CloseDayDto {
  shopId: string;
  tradingDate?: string; // YYYY-MM-DD, defaults to today
  countedCash: number;
  notes?: string;
}

@Injectable()
export class EodService {
  constructor(
    @InjectRepository(ShopExpense) private readonly expenses: Repository<ShopExpense>,
    @InjectRepository(ShopCashCount) private readonly counts: Repository<ShopCashCount>,
    @InjectRepository(PosOrder) private readonly orders: Repository<PosOrder>,
    private readonly shops: ShopsService,
  ) {}

  // ── Expenses ────────────────────────────────────────────────────────────

  async listExpenses(ownerId: string, shopId: string, fromIso?: string, toIso?: string) {
    await this.shops.assertOwned(ownerId, shopId);
    const { from, to } = this.parseRange(fromIso, toIso);
    return this.expenses.find({
      where: { ownerId, shopId, createdAt: Between(from, to) },
      order: { createdAt: 'DESC' },
    });
  }

  async createExpense(ownerId: string, dto: CreateExpenseDto, recordedBy?: string) {
    const shop = await this.shops.assertOwned(ownerId, dto.shopId);
    if (!dto.amount || dto.amount <= 0) throw new BadRequestException('Amount must be > 0');
    return this.expenses.save(
      this.expenses.create({
        ownerId,
        shopId: shop.id,
        amount: dto.amount,
        currency: dto.currency ?? shop.currency,
        category: dto.category ?? 'other',
        description: dto.description ?? '',
        receiptUrl: dto.receiptUrl ?? null,
        paidVia: dto.paidVia ?? 'cash',
        recordedBy: recordedBy ?? null,
      }),
    );
  }

  async removeExpense(ownerId: string, id: string) {
    const row = await this.expenses.findOne({ where: { ownerId, id } });
    if (!row) throw new NotFoundException('Expense not found');
    await this.expenses.remove(row);
    return { removed: true };
  }

  /** Category catalogue with friendly labels — consumed by the EOD UI. */
  listCategories() {
    return Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
  }

  // ── End-of-day summary + close ─────────────────────────────────────────

  /**
   * Compute the "day in progress" view: cash sales, cash expenses,
   * expected cash in the till. The cashier reads this, counts physical
   * cash, then calls closeDay() with the count.
   */
  async daySummary(ownerId: string, shopId: string, tradingDate?: string) {
    const shop = await this.shops.assertOwned(ownerId, shopId);
    const date = tradingDate ?? new Date().toISOString().slice(0, 10);
    const { from, to } = this.parseRange(date, date);

    // CASH sales only — BNPL / card / mobile money don't add to the till.
    const cashOrders = await this.orders.find({
      where: { ownerId, createdAt: Between(from, to) },
    });
    const cashSales = cashOrders
      .filter((o) => (o.paymentMethod ?? '').toUpperCase() === 'CASH' && o.status !== 'CANCELLED')
      .reduce((s, o) => s + Number(o.total), 0);

    const expenseRows = await this.expenses.find({ where: { ownerId, shopId, createdAt: Between(from, to) } });
    const cashExpenses = expenseRows
      .filter((e) => e.paidVia === 'cash')
      .reduce((s, e) => s + Number(e.amount), 0);

    const openingFloat = Number(shop.openingFloat);
    const expectedCash = parseFloat((openingFloat + cashSales - cashExpenses).toFixed(2));

    const breakdownByCategory = expenseRows.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
      return acc;
    }, {});

    return {
      shopId: shop.id,
      shopName: shop.name,
      tradingDate: date,
      openingFloat,
      cashSales,
      cashExpenses,
      expectedCash,
      currency: shop.currency,
      expenseCount: expenseRows.length,
      breakdownByCategory,
    };
  }

  async closeDay(ownerId: string, dto: CloseDayDto, closedBy?: string) {
    const shop = await this.shops.assertOwned(ownerId, dto.shopId);
    const date = dto.tradingDate ?? new Date().toISOString().slice(0, 10);
    const summary = await this.daySummary(ownerId, dto.shopId, date);

    const variance = parseFloat((dto.countedCash - summary.expectedCash).toFixed(2));

    // Prevent two close-outs for the same trading day per shop.
    const existing = await this.counts.findOne({ where: { ownerId, shopId: shop.id, tradingDate: date } });
    if (existing) {
      Object.assign(existing, {
        openingFloat: summary.openingFloat,
        cashSales: summary.cashSales,
        cashExpenses: summary.cashExpenses,
        expectedCash: summary.expectedCash,
        countedCash: dto.countedCash,
        variance,
        notes: dto.notes ?? existing.notes,
        currency: summary.currency,
        closedAt: new Date(),
        closedBy: closedBy ?? existing.closedBy,
      });
      return this.counts.save(existing);
    }

    return this.counts.save(
      this.counts.create({
        ownerId,
        shopId: shop.id,
        tradingDate: date,
        openingFloat: summary.openingFloat,
        cashSales: summary.cashSales,
        cashExpenses: summary.cashExpenses,
        expectedCash: summary.expectedCash,
        countedCash: dto.countedCash,
        variance,
        notes: dto.notes ?? '',
        currency: summary.currency,
        closedAt: new Date(),
        closedBy: closedBy ?? null,
      }),
    );
  }

  async listCashCounts(ownerId: string, shopId: string, fromIso?: string, toIso?: string) {
    await this.shops.assertOwned(ownerId, shopId);
    const { from, to } = this.parseRange(fromIso, toIso);
    return this.counts.find({
      where: { ownerId, shopId, closedAt: Between(from, to) },
      order: { closedAt: 'DESC' },
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private parseRange(fromIso?: string, toIso?: string): { from: Date; to: Date } {
    const today = new Date();
    const f = fromIso ? new Date(fromIso) : new Date(today.getFullYear(), today.getMonth(), 1);
    const t = toIso ? new Date(`${toIso}T23:59:59.999Z`) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: f, to: t };
  }
}
