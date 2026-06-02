import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { PaymentTransaction } from '../payments/payments.entity';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { Contact } from '../contacts/contact.entity';
import { PrintJob } from '../print/print.entity';
import { SupplierCapitalService } from './supplier-capital.service';

@Injectable()
export class ErpService {
  constructor(
    @InjectRepository(PaymentTransaction) private readonly txRepo: Repository<PaymentTransaction>,
    @InjectRepository(PosOrder)           private readonly ordersRepo: Repository<PosOrder>,
    @InjectRepository(PosProduct)         private readonly productsRepo: Repository<PosProduct>,
    @InjectRepository(WarehouseItem)      private readonly warehouseRepo: Repository<WarehouseItem>,
    @InjectRepository(Contact)            private readonly contactsRepo: Repository<Contact>,
    @InjectRepository(PrintJob)           private readonly printRepo: Repository<PrintJob>,
    private readonly supplierCapital: SupplierCapitalService,
  ) {}

  // ── ERP Dashboard ─────────────────────────────────────────────────────────

  async getDashboard(uid: string) {
    const [txs, orders, warehouseItems, contacts, supplierCapital] = await Promise.all([
      this.txRepo.find({ where: { ownerId: uid } }),
      this.ordersRepo.find({ where: { ownerId: uid } }),
      this.warehouseRepo.find({ where: { ownerId: uid } }),
      this.contactsRepo.find({ where: { ownerId: uid } }),
      this.supplierCapital.summary(uid),
    ]);

    const completedOrders = orders.filter(o => o.status === 'COMPLETED');
    const revenue = completedOrders.reduce((s, o) => s + Number(o.total), 0);
    const lowStock = warehouseItems.filter(w => Number(w.quantity) <= Number(w.reorderLevel));

    // Monthly revenue for last 6 months
    const now = new Date();
    const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const monthOrders = completedOrders.filter(o => {
        const od = new Date(o.createdAt);
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
      });
      return { month: label, revenue: monthOrders.reduce((s, o) => s + Number(o.total), 0) };
    });

    return {
      kpis: {
        revenue,
        orders:      orders.length,
        customers:   contacts.length,
        lowStock:    lowStock.length,
        transactions: txs.length,
        supplierPaidCny: supplierCapital.totalSupplierReceivedCny,
        supplierRemainingCny: supplierCapital.remainingPoCny,
        supplierNeedsAction: supplierCapital.needsAction,
      },
      monthlyRevenue,
      supplierCapital,
    };
  }

  // ── Accounting ────────────────────────────────────────────────────────────

  async getAccounting(uid: string) {
    const txs = await this.txRepo.find({
      where: { ownerId: uid },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const supplierCapital = await this.supplierCapital.summary(uid);
    const income   = txs.filter(t => t.type === 'CREDIT' && t.status === 'COMPLETED').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = txs.filter(t => t.type === 'DEBIT'  && t.status === 'COMPLETED').reduce((s, t) => s + Number(t.amount), 0);

    return {
      summary: {
        income,
        expenses,
        profit: income - expenses,
        supplierCapitalCny: supplierCapital.totalSupplierReceivedCny,
        supplierUnallocatedCny: supplierCapital.unallocatedCny,
        remainingSupplierPoCny: supplierCapital.remainingPoCny,
      },
      supplierCapital,
      transactions: txs.map(t => ({
        id:          t.id,
        date:        t.createdAt,
        description: t.description || t.type,
        type:        t.type,
        amount:      Number(t.amount),
        currency:    t.currency,
        status:      t.status,
        reference:   t.reference,
      })),
    };
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  async getReports(uid: string) {
    const [txs, orders, printJobs] = await Promise.all([
      this.txRepo.find({ where: { ownerId: uid } }),
      this.ordersRepo.find({ where: { ownerId: uid } }),
      this.printRepo.find({ where: { ownerId: uid } }),
    ]);

    const now = new Date();
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const inMonth = (date: Date) =>
        new Date(date).getFullYear() === d.getFullYear() &&
        new Date(date).getMonth() === d.getMonth();

      const monthOrders = orders.filter(o => o.status === 'COMPLETED' && inMonth(o.createdAt));
      const monthTxs    = txs.filter(t => t.type === 'CREDIT' && t.status === 'COMPLETED' && inMonth(t.createdAt));
      return {
        month:         label,
        revenue:       monthOrders.reduce((s, o) => s + Number(o.total), 0),
        transactions:  monthTxs.length,
        orders:        monthOrders.length,
      };
    });

    const totalRevenue = orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + Number(o.total), 0);
    const printRevenue = printJobs.filter(j => j.status === 'Completed').reduce((s, j) => Number(j.price) * j.qty + s, 0);

    return {
      summary: {
        totalRevenue,
        printRevenue,
        totalOrders:  orders.length,
        completedOrders: orders.filter(o => o.status === 'COMPLETED').length,
      },
      monthly,
    };
  }

  // ── Loyalty ───────────────────────────────────────────────────────────────

  async getLoyalty(uid: string) {
    const contacts = await this.contactsRepo.find({
      where: { ownerId: uid },
      order: { createdAt: 'DESC' },
    });

    // Derive loyalty points from POS orders per customer name
    const orders = await this.ordersRepo.find({ where: { ownerId: uid, status: 'COMPLETED' } });
    const pointsMap: Record<string, number> = {};
    for (const o of orders) {
      const name = o.customerName || 'Walk-in';
      pointsMap[name] = (pointsMap[name] || 0) + Math.floor(Number(o.total) / 1000);
    }

    const customers = contacts.map(c => ({
      id:     c.id,
      name:   c.name,
      email:  c.email,
      phone:  c.phone,
      points: pointsMap[c.name] || 0,
      tier:   pointsMap[c.name] >= 5000 ? 'Gold' : pointsMap[c.name] >= 1000 ? 'Silver' : 'Bronze',
    }));

    const totalPoints = customers.reduce((s, c) => s + c.points, 0);
    return {
      summary: {
        totalCustomers: customers.length,
        totalPoints,
        gold:   customers.filter(c => c.tier === 'Gold').length,
        silver: customers.filter(c => c.tier === 'Silver').length,
        bronze: customers.filter(c => c.tier === 'Bronze').length,
      },
      customers,
    };
  }

  // ── Sourcing ──────────────────────────────────────────────────────────────

  async getSourcing(uid: string) {
    const [items, supplierCapital] = await Promise.all([
      this.warehouseRepo.find({
        where: { ownerId: uid },
        order: { createdAt: 'DESC' },
      }),
      this.supplierCapital.summary(uid),
    ]);

    // Group by category (no supplier field — use category as proxy)
    const categoryMap: Record<string, { name: string; items: number; totalValue: number }> = {};
    for (const item of items) {
      const cat = item.category || 'Uncategorised';
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, items: 0, totalValue: 0 };
      categoryMap[cat].items++;
      categoryMap[cat].totalValue += Number(item.quantity) * Number(item.unitCost);
    }

    const suppliers = Object.values(categoryMap).map((s, i) => ({
      id:         String(i + 1),
      name:       s.name,
      items:      s.items,
      totalValue: s.totalValue,
      status:     'Active',
    }));

    const lowStock = items.filter(w => Number(w.quantity) <= Number(w.reorderLevel));
    return {
      summary: {
        suppliers:    supplierCapital.suppliers || suppliers.length,
        totalItems:   items.length,
        lowStock:     lowStock.length,
        totalValue:   items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitCost), 0),
        supplierPaidCny: supplierCapital.totalSupplierReceivedCny,
        supplierRemainingCny: supplierCapital.remainingPoCny,
        unallocatedCny: supplierCapital.unallocatedCny,
      },
      suppliers,
      supplierCapital,
      lowStockItems: lowStock.map(i => ({
        id:           i.id,
        name:         i.name,
        sku:          i.sku,
        quantity:     Number(i.quantity),
        reorderLevel: Number(i.reorderLevel),
        category:     i.category,
      })),
    };
  }
}
