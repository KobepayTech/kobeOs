import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ShopCashCount, ShopExpense } from '../eod/eod.entity';
import { ErpPurchaseOrder } from '../erp/supplier-capital.entity';
import { poItems } from '../erp/supplier-capital.service';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { Shop } from '../shops/shop.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import type { OwnerReportKey } from './owner-report.types';

const DISPLAY_LIMIT = 8;
const ORDER_SCAN_LIMIT = 100;
const MIN_MARGIN_PERCENT = 15;
const money = (amount: number | string, currency: string) =>
  `${currency} ${Number(amount).toLocaleString('en', { maximumFractionDigits: 4 })}`;

interface ReportScope {
  ownerId: string;
  timezone: string;
  asOf: Date;
  today: string;
}

@Injectable()
export class OwnerReportService {
  constructor(private readonly db: DataSource) {}

  async run(ownerId: string, key: OwnerReportKey, timezone: string, asOf: Date) {
    return this.db.transaction('REPEATABLE READ', async tx => {
      await tx.query('SET TRANSACTION READ ONLY');
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(asOf);
      const scope: ReportScope = { ownerId, timezone, asOf, today };
      switch (key) {
        case 'shop-close': return this.shopClose(tx, scope);
        case 'stock-watch': return this.stockWatch(tx, ownerId);
        case 'margin-watch': return this.marginWatch(tx, ownerId);
        case 'incoming-watch': return this.incomingWatch(tx, scope);
      }
    });
  }

  private async shopClose(tx: EntityManager, scope: ReportScope) {
    const { ownerId, today } = scope;
    const sinceOpening = (alias: string) =>
      `${alias}."createdAt" >= (CAST(:today AS date)::timestamp AT TIME ZONE :timezone) AND ${alias}."createdAt" <= :asOf`;
    const sales = await tx.getRepository(PosOrder).createQueryBuilder('o')
      .select('o.currency', 'currency').addSelect('UPPER(o.paymentMethod)', 'method')
      .addSelect('COUNT(*)::int', 'count').addSelect('SUM(o.total)::text', 'amount')
      .where('o.ownerId = :ownerId').andWhere("o.status = 'COMPLETED'")
      .andWhere(sinceOpening('o')).setParameters({ ...scope })
      .groupBy('o.currency').addGroupBy('UPPER(o.paymentMethod)').orderBy('o.currency').addOrderBy('method')
      .getRawMany<{ currency: string; method: string; count: number; amount: string }>();
    const expenses = await tx.getRepository(ShopExpense).createQueryBuilder('e')
      .select('e.currency', 'currency').addSelect('e.paidVia', 'method').addSelect('SUM(e.amount)::text', 'amount')
      .where('e.ownerId = :ownerId').andWhere(sinceOpening('e')).setParameters({ ...scope })
      .groupBy('e.currency').addGroupBy('e.paidVia').orderBy('e.currency').addOrderBy('method')
      .getRawMany<{ currency: string; method: string; amount: string }>();
    const counts = await tx.getRepository(ShopCashCount).createQueryBuilder('c')
      .select(['c.id', 'c.shopId', 'c.currency', 'c.closedAt', 'c.countedCash', 'c.expectedCash', 'c.variance'])
      .distinctOn(['c.shopId', 'c.currency']).where('c.ownerId = :ownerId', { ownerId })
      .andWhere('c.tradingDate = :today AND c.closedAt <= :asOf', { today, asOf: scope.asOf })
      .orderBy('c.shopId').addOrderBy('c.currency').addOrderBy('c.closedAt', 'DESC').addOrderBy('c.id', 'DESC').getMany();
    const shops = await tx.find(Shop, { where: { ownerId }, select: { id: true, name: true, active: true } });
    const shopNames = new Map(shops.map(shop => [shop.id, shop.name]));
    const countedShops = new Set(counts.map(count => count.shopId));
    const missing = shops.filter(shop => shop.active && !countedShops.has(shop.id)).map(shop => shop.name);
    const lines = [
      `Shop close · ${today} (${scope.timezone})`,
      ...(sales.length ? ['Completed POS orders', ...sales.map(row => `${row.method}: ${money(row.amount, row.currency)} across ${row.count} order(s)`)] : ['No completed POS orders recorded today.']),
      ...(expenses.length ? ['Recorded expenses', ...expenses.map(row => `${row.method}: ${money(row.amount, row.currency)}`)] : ['No expenses recorded today.']),
      ...(counts.length ? ['Latest till counts', ...counts.map(count =>
        `${shopNames.get(count.shopId) ?? 'Archived shop'}: counted ${money(count.countedCash, count.currency)}, expected ${money(count.expectedCash, count.currency)}, variance ${money(count.variance, count.currency)}`)] : ['No till close recorded for today.']),
    ];
    if (missing.length) lines.push(`Awaiting a till close: ${missing.join(', ')}.`);
    if (counts.some(count => Number(count.variance) !== 0)) lines.push('Review the till variances against the recorded close-outs.');
    lines.push('Sales are recorded order totals by payment method. Bank and provider settlement are checked separately.');
    return { reply: lines.join('\n'), data: { today, sales, expenses, counts, missing } };
  }

  private async stockWatch(tx: EntityManager, ownerId: string) {
    const products = await tx.getRepository(PosProduct).createQueryBuilder('p')
      .select(['p.id', 'p.name', 'p.sku', 'p.stock', 'p.reservedStock'])
      .where('p.ownerId = :ownerId AND p.active = true AND p.stock <= 5', { ownerId })
      .orderBy('p.stock').addOrderBy('p.name').addOrderBy('p.id').take(DISPLAY_LIMIT + 1).getMany();
    const warehouse = await tx.getRepository(WarehouseItem).createQueryBuilder('w')
      .select(['w.id', 'w.name', 'w.sku', 'w.quantity', 'w.reorderLevel', 'w.unit'])
      .where('w.ownerId = :ownerId AND w.quantity <= w.reorderLevel', { ownerId })
      .orderBy('w.quantity - w.reorderLevel').addOrderBy('w.name').addOrderBy('w.id').take(DISPLAY_LIMIT + 1).getMany();
    const posRows = products.slice(0, DISPLAY_LIMIT);
    const warehouseRows = warehouse.slice(0, DISPLAY_LIMIT);
    const lines = [
      'POS on-hand stock (five units or fewer)',
      ...posRows.map(row => `${row.name} (${row.sku}): ${row.stock} on hand, ${row.reservedStock} reserved`),
      ...(posRows.length ? [] : ['No active POS products met this threshold.']),
      ...(products.length > DISPLAY_LIMIT ? ['More items are available in POS inventory.'] : []),
      'Warehouse items at or below their reorder level',
      ...warehouseRows.map(row => `${row.name} (${row.sku}): ${row.quantity} ${row.unit}, reorder level ${row.reorderLevel}`),
      ...(warehouseRows.length ? [] : ['No warehouse items met their reorder level.']),
      ...(warehouse.length > DISPLAY_LIMIT ? ['More items are available in warehouse inventory.'] : []),
      'Review zero-stock items first and check incoming orders before buying. POS and warehouse counts may refer to the same goods.',
    ];
    return { reply: lines.join('\n'), data: { pos: posRows, warehouse: warehouseRows } };
  }

  private async marginWatch(tx: EntityManager, ownerId: string) {
    const base = tx.getRepository(PosProduct).createQueryBuilder('p')
      .select(['p.id', 'p.name', 'p.sku', 'p.price', 'p.cost', 'p.currency'])
      .where('p.ownerId = :ownerId AND p.active = true', { ownerId });
    const missing = await base.clone().andWhere('p.cost IS NULL').getCount();
    const weak = await base.clone().andWhere('p.cost IS NOT NULL AND p.price >= 0')
      .andWhere('(p.price - p.cost) * 100 < p.price * :minimum', { minimum: MIN_MARGIN_PERCENT })
      .orderBy('p.price = 0', 'DESC').addOrderBy('(p.price - p.cost) / NULLIF(p.price, 0)').addOrderBy('p.id').take(DISPLAY_LIMIT + 1).getMany();
    const rows = weak.slice(0, DISPLAY_LIMIT);
    const lines = [
      `Catalogue prices below ${MIN_MARGIN_PERCENT}% estimated gross margin`,
      ...rows.map(row => {
        const price = Number(row.price);
        const cost = Number(row.cost);
        const margin = price > 0 ? `gross margin ${((price - cost) * 100 / price).toFixed(1)}%` : 'selling price is zero';
        return `${row.name} (${row.sku}): sell at ${money(price, row.currency)}, cost ${money(cost, row.currency)}, ${margin}`;
      }),
      ...(rows.length ? [] : ['No products with a recorded cost fell below this threshold.']),
      ...(weak.length > DISPLAY_LIMIT ? ['More products are below the threshold.'] : []),
      `${missing} active product(s) missing a recorded cost. Add those costs before comparing margins.`,
      'These estimates use current catalogue prices and recorded unit costs. Actual sales, discounts and operating expenses are separate.',
    ];
    return { reply: lines.join('\n'), data: { rows, missingCosts: missing } };
  }

  private async incomingWatch(tx: EntityManager, scope: ReportScope) {
    const deadline = new Date(`${scope.today}T00:00:00Z`);
    deadline.setUTCDate(deadline.getUTCDate() + 7);
    const weekEnd = deadline.toISOString().slice(0, 10);
    // Older ERP orders store a text delivery date. Keep ISO dates readable
    // without casting arbitrary legacy text to a PostgreSQL date.
    const eta = `COALESCE(po."expectedDate"::text, SUBSTRING(po."deliveryDate" FROM '^[0-9]{4}-[0-9]{2}-[0-9]{2}'))`;
    const { entities: orders, raw } = await tx.getRepository(ErpPurchaseOrder).createQueryBuilder('po')
      .addSelect(eta, 'report_eta')
      .where('po.ownerId = :ownerId AND po."inventoryStatus" = :status', { ownerId: scope.ownerId, status: 'PENDING' })
      .andWhere("LOWER(po.status) NOT IN ('cancelled', 'delivered')")
      .andWhere(`(${eta} IS NULL OR ${eta} <= :weekEnd)`, { weekEnd })
      .orderBy('report_eta', 'ASC', 'NULLS LAST').addOrderBy('po.createdAt', 'ASC').addOrderBy('po.id')
      .take(ORDER_SCAN_LIMIT + 1).getRawAndEntities();
    const pending = orders.slice(0, ORDER_SCAN_LIMIT).map((order, index) => {
      const items = poItems(order);
      const remaining = items.reduce((sum, item) =>
        sum + Math.max(0, item.qty - (item.receivedQty ?? 0) - (item.damagedQty ?? 0)), 0);
      return { reference: order.poNumber, eta: raw[index].report_eta as string | null, remaining: items.length ? remaining : null };
    }).filter(order => order.remaining !== 0);
    const overdue = pending.filter(order => order.eta && order.eta < scope.today);
    const due = pending.filter(order => order.eta && order.eta >= scope.today && order.eta <= weekEnd);
    const undated = pending.filter(order => !order.eta);
    const show = (label: string, rows: typeof pending) => [
      `${label} (${rows.length})`,
      ...rows.slice(0, DISPLAY_LIMIT).map(row =>
        `${row.reference}${row.eta ? ` · ${row.eta}` : ''}: ${row.remaining ?? 'unknown'} units still expected`),
    ];
    const lines = [
      ...show('Overdue', overdue), ...show('Due within seven days', due), ...show('Missing ETA', undated),
      ...(orders.length > ORDER_SCAN_LIMIT ? [`Review covers ${ORDER_SCAN_LIMIT} open orders. See Shipments for the full list.`] : []),
      'Confirm ETAs on overdue or undated orders. Incoming units remain separate from received stock.',
    ];
    return { reply: lines.join('\n'), data: { overdue: overdue.slice(0, DISPLAY_LIMIT), due: due.slice(0, DISPLAY_LIMIT), undated: undated.slice(0, DISPLAY_LIMIT) } };
  }
}
