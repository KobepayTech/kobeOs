import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpAccount, ErpTransaction } from './erp.entity';
import { PosOrder, PosOrderItem, PosProduct } from '../pos/pos.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Read-only cross-module rollups for the ERP dashboard & reports apps.
 * Everything is computed live from the caller's own data (POS orders/products,
 * warehouse stock, ERP chart of accounts) — no separate stored aggregates.
 */
@Injectable()
export class ErpSummaryService {
  constructor(
    @InjectRepository(PosOrder) private readonly orders: Repository<PosOrder>,
    @InjectRepository(PosOrderItem) private readonly orderItems: Repository<PosOrderItem>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    @InjectRepository(WarehouseItem) private readonly warehouse: Repository<WarehouseItem>,
    @InjectRepository(ErpAccount) private readonly accounts: Repository<ErpAccount>,
    @InjectRepository(ErpTransaction) private readonly transactions: Repository<ErpTransaction>,
  ) {}

  async summary(ownerId: string) {
    const [orders, products, warehouse, accounts, transactions] = await Promise.all([
      this.orders.find({ where: { ownerId }, order: { createdAt: 'DESC' } }),
      this.products.find({ where: { ownerId } }),
      this.warehouse.find({ where: { ownerId } }),
      this.accounts.find({ where: { ownerId } }),
      this.transactions.find({ where: { ownerId } }),
    ]);

    const completed = orders.filter((o) => o.status === 'COMPLETED');
    const revenue = completed.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const pending = orders.filter((o) => o.status === 'PENDING').length;

    // item counts for the five most recent orders
    const recent = orders.slice(0, 5);
    const counts = await this.itemCounts(recent.map((o) => o.id));
    const recentOrders = recent.map((o) => ({
      id: o.orderNumber,
      customer: o.customerName || 'Walk-in',
      items: counts[o.id] ?? 0,
      total: Number(o.total ?? 0),
      status: (o.status ?? 'PENDING').toLowerCase(),
    }));

    // sales for the last 7 calendar days, oldest-first
    const salesByDay = this.salesByDay(completed);

    // product mix by category (sum of list price), top 5 + "Other"
    const categories = this.categories(products);

    // low/again-stock alerts
    const inventoryAlerts = warehouse
      .filter((w) => w.quantity <= w.reorderLevel)
      .slice(0, 10)
      .map((w) => ({ sku: w.sku, name: w.name, stock: w.quantity, threshold: w.reorderLevel }));

    // account-derived statements
    const byType = (t: string) => accounts.filter((a) => a.type === t);
    const sum = (arr: ErpAccount[]) => arr.reduce((s, a) => s + (a.balance ?? 0), 0);
    const section = (label: string, type: string) => {
      const items = byType(type).map((a) => ({ label: a.name, value: a.balance ?? 0 }));
      return { section: label, items, total: sum(byType(type)) };
    };
    const balanceSheet = [section('ASSETS', 'Asset'), section('LIABILITIES', 'Liability'), section('EQUITY', 'Equity')];
    const revenueAccounts = sum(byType('Revenue'));
    const expenseAccounts = sum(byType('Expense'));
    const expenseBreakdown = byType('Expense')
      .map((a) => ({ name: a.name, value: a.balance ?? 0 }))
      .sort((x, y) => y.value - x.value);

    const monthlyTrend = this.monthlyTrend(accounts, transactions);

    return {
      kpis: {
        revenue,
        orders: orders.length,
        pending,
        completed: completed.length,
        products: products.length,
        lowStock: inventoryAlerts.length,
      },
      recentOrders,
      salesByDay,
      categories,
      inventoryAlerts,
      accounts: {
        balanceSheet,
        expenseBreakdown,
        monthlyTrend,
        pl: {
          revenue: revenueAccounts,
          expenses: expenseAccounts,
          netIncome: revenueAccounts - expenseAccounts,
        },
      },
    };
  }

  private async itemCounts(orderIds: string[]): Promise<Record<string, number>> {
    if (orderIds.length === 0) return {};
    const items = await this.orderItems
      .createQueryBuilder('i')
      .select('i.orderId', 'orderId')
      .addSelect('SUM(i.quantity)', 'qty')
      .where('i.orderId IN (:...ids)', { ids: orderIds })
      .groupBy('i.orderId')
      .getRawMany<{ orderId: string; qty: string }>();
    const out: Record<string, number> = {};
    for (const row of items) out[row.orderId] = Number(row.qty) || 0;
    return out;
  }

  private salesByDay(completed: PosOrder[]) {
    const today = new Date();
    const buckets: { day: string; sales: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.push({ day: DAY_LABELS[d.getDay()], sales: 0 });
    }
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    for (const o of completed) {
      const created = new Date(o.createdAt);
      if (created < start) continue;
      const idx = Math.floor((created.getTime() - start.getTime()) / 86_400_000);
      if (idx >= 0 && idx < 7) buckets[idx].sales += Number(o.total ?? 0);
    }
    return buckets;
  }

  /**
   * Real monthly P&L series for the last 6 calendar months, derived from the
   * accounting ledger: revenue = credits to Revenue accounts, expenses = debits
   * to Expense accounts (split into COGS vs operating). Months with no posted
   * transactions come back as zeroes.
   */
  private monthlyTrend(accounts: ErpAccount[], transactions: ErpTransaction[]) {
    const byCode = new Map<string, { type: string; isCogs: boolean }>();
    for (const a of accounts) {
      const isCogs = /cogs|cost of goods/i.test(a.name);
      byCode.set(a.code, { type: a.type, isCogs });
    }

    const now = new Date();
    const buckets = new Map<string, {
      month: string; revenue: number; cogs: number; opex: number; expenses: number; netIncome: number;
    }>();
    const order: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      order.push(key);
      buckets.set(key, { month: MONTH_LABELS[d.getMonth()], revenue: 0, cogs: 0, opex: 0, expenses: 0, netIncome: 0 });
    }

    for (const t of transactions) {
      if (!t.date) continue;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.get(key);
      if (!b) continue;
      const acct = byCode.get(t.account);
      if (!acct) continue;
      if (acct.type === 'Revenue') {
        b.revenue += t.credit ?? 0;
      } else if (acct.type === 'Expense') {
        const amt = t.debit ?? 0;
        b.expenses += amt;
        if (acct.isCogs) b.cogs += amt; else b.opex += amt;
      }
    }

    return order.map((k) => {
      const b = buckets.get(k)!;
      b.netIncome = b.revenue - b.expenses;
      return b;
    });
  }

  private categories(products: PosProduct[]) {
    const map = new Map<string, number>();
    for (const p of products) {
      const key = p.category || 'Other';
      map.set(key, (map.get(key) ?? 0) + Number(p.price ?? 0));
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }));
    const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) top.push({ name: 'Other', value: rest });
    return top;
  }
}
