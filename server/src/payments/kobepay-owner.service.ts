import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentAllocation,
  PaymentCustomer,
  PaymentDeposit,
  PaymentPayout,
  PaymentSupplier,
} from './kobepay.entity';

export interface ProfitEntry {
  depositId: string;
  transactionId: string;
  customerName: string;
  supplierName: string | null;
  targetAmount: number;
  targetCurrency: string;
  collectedTzs: number;
  actualCostTzs: number;
  fees: number;
  profitTzs: number;
  status: 'Projected' | 'Realized';
  payoutStatus: string | null;
  date: string;
}

export interface ProfitBucket {
  label: string;
  collected: number;
  actualCost: number;
  fees: number;
  realizedProfit: number;
  projectedProfit: number;
}

export interface OwnerDashboard {
  kpis: {
    totalCollected: number;
    totalPaidToSuppliers: number;
    grossProfit: number;
    serviceFees: number;
    exchangeProfit: number;
    bankAndMobileCharges: number;
    agentCommissions: number;
    netProfit: number;
    realizedProfit: number;
    projectedProfit: number;
    pendingPayouts: number;
    unassignedFunds: number;
    customerCount: number;
    supplierCount: number;
  };
  entries: ProfitEntry[];
  daily: ProfitBucket[];
  weekly: ProfitBucket[];
  monthly: ProfitBucket[];
  byCustomer: Array<{ id: string; name: string; collected: number; realizedProfit: number }>;
  bySupplier: Array<{ id: string; name: string; paidTzs: number; realizedProfit: number }>;
}

const D = (x: string | number | null | undefined) => (x == null ? 0 : Number(x));

@Injectable()
export class KobePayOwnerService {
  constructor(
    @InjectRepository(PaymentCustomer) private readonly customers: Repository<PaymentCustomer>,
    @InjectRepository(PaymentSupplier) private readonly suppliers: Repository<PaymentSupplier>,
    @InjectRepository(PaymentDeposit) private readonly deposits: Repository<PaymentDeposit>,
    @InjectRepository(PaymentPayout) private readonly payouts: Repository<PaymentPayout>,
    @InjectRepository(PaymentAllocation) private readonly allocations: Repository<PaymentAllocation>,
  ) {}

  async dashboard(uid: string): Promise<OwnerDashboard> {
    const [customers, suppliers, deposits, payouts, allocations] = await Promise.all([
      this.customers.find({ where: { ownerId: uid } }),
      this.suppliers.find({ where: { ownerId: uid } }),
      this.deposits.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } }),
      this.payouts.find({ where: { ownerId: uid } }),
      this.allocations.find({ where: { ownerId: uid } }),
    ]);

    // Index payouts by depositId so each deposit can find its fulfilling payout(s).
    const payoutsByDeposit: Record<string, PaymentPayout[]> = {};
    for (const p of payouts) {
      if (!p.depositId) continue;
      if (!payoutsByDeposit[p.depositId]) payoutsByDeposit[p.depositId] = [];
      payoutsByDeposit[p.depositId].push(p);
    }

    const entries: ProfitEntry[] = deposits
      .filter((d) => d.status === 'Confirmed')
      .map((d) => {
        const linked = payoutsByDeposit[d.id] ?? [];
        const paid = linked.find((p) => p.status === 'PAID');
        const collected = D(d.collectedTzs);
        let actualCost = 0;
        let fees = 0;
        if (paid) {
          actualCost = D(paid.actualCostTzs);
          fees = D(paid.transactionFees) + D(paid.bankCharges) + D(paid.mobileMoneyCharges) + D(paid.agentCommission);
        }
        return {
          depositId: d.id,
          transactionId: `TXN-${d.createdAt.toISOString().slice(0, 10).replace(/-/g, '')}-${d.id.slice(0, 6).toUpperCase()}`,
          customerName: d.customerName,
          supplierName: linked[0]?.supplierName ?? null,
          targetAmount: D(d.targetAmount),
          targetCurrency: d.targetCurrency,
          collectedTzs: collected,
          actualCostTzs: actualCost,
          fees,
          profitTzs: paid ? parseFloat((collected - actualCost - fees).toFixed(4)) : 0,
          status: paid ? 'Realized' as const : 'Projected' as const,
          payoutStatus: linked[0]?.status ?? null,
          date: d.createdAt.toISOString().slice(0, 10),
        };
      });

    const realized = entries.filter((e) => e.status === 'Realized');
    const projected = entries.filter((e) => e.status === 'Projected');

    const totalCollected = entries.reduce((s, e) => s + e.collectedTzs, 0);
    const totalPaidToSuppliers = realized.reduce((s, e) => s + e.actualCostTzs, 0);
    const grossProfit = realized.reduce((s, e) => s + (e.collectedTzs - e.actualCostTzs), 0);
    const serviceFees = deposits.reduce((s, d) => s + D(d.serviceFee), 0);
    const realizedProfit = realized.reduce((s, e) => s + e.profitTzs, 0);
    const projectedProfit = projected.reduce((s, e) => s + e.collectedTzs, 0);

    // Exchange profit isolates the FX leg: (sales rate − cost rate) × targetAmount.
    const exchangeProfit = realized.reduce((s, e) => {
      const deposit = deposits.find((d) => d.id === e.depositId);
      const paid = (payoutsByDeposit[e.depositId] ?? []).find((p) => p.status === 'PAID');
      if (!deposit || !paid) return s;
      const sales = D(deposit.salesRate);
      const cost = D(paid.actualRate);
      const qty = D(deposit.targetAmount);
      return s + (sales - cost) * qty;
    }, 0);

    const bankAndMobileCharges = payouts.reduce(
      (s, p) => s + (p.status === 'PAID' ? D(p.bankCharges) + D(p.mobileMoneyCharges) + D(p.transactionFees) : 0),
      0,
    );
    const agentCommissions = payouts.reduce(
      (s, p) => s + (p.status === 'PAID' ? D(p.agentCommission) : 0),
      0,
    );
    const netProfit = realizedProfit + serviceFees;
    const pendingPayouts = payouts
      .filter((p) => p.status === 'INITIATED' || p.status === 'SENT' || p.status === 'CONFIRMED')
      .reduce((s, p) => s + D(p.actualCostTzs || p.amount), 0);
    const unassignedFunds = customers.reduce((s, c) => s + D(c.balance), 0);

    const buckets = (size: 'day' | 'week' | 'month'): ProfitBucket[] => {
      const map: Record<string, ProfitBucket> = {};
      for (const e of entries) {
        const d = new Date(e.date);
        let label = '';
        if (size === 'day') label = e.date;
        else if (size === 'week') {
          const day = d.getDay();
          const monday = new Date(d);
          monday.setDate(d.getDate() - ((day + 6) % 7));
          label = monday.toISOString().slice(0, 10);
        } else {
          label = e.date.slice(0, 7);
        }
        const acc = map[label] ?? { label, collected: 0, actualCost: 0, fees: 0, realizedProfit: 0, projectedProfit: 0 };
        acc.collected += e.collectedTzs;
        if (e.status === 'Realized') {
          acc.actualCost += e.actualCostTzs;
          acc.fees += e.fees;
          acc.realizedProfit += e.profitTzs;
        } else {
          acc.projectedProfit += e.collectedTzs;
        }
        map[label] = acc;
      }
      return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
    };

    // Bucket pivots by customer / supplier.
    const byCustomer: Record<string, { id: string; name: string; collected: number; realizedProfit: number }> = {};
    for (const e of entries) {
      const dep = deposits.find((d) => d.id === e.depositId);
      if (!dep) continue;
      const cid = dep.customerId;
      const acc = byCustomer[cid] ?? { id: cid, name: dep.customerName, collected: 0, realizedProfit: 0 };
      acc.collected += e.collectedTzs;
      if (e.status === 'Realized') acc.realizedProfit += e.profitTzs;
      byCustomer[cid] = acc;
    }
    const bySupplier: Record<string, { id: string; name: string; paidTzs: number; realizedProfit: number }> = {};
    for (const p of payouts) {
      if (p.status !== 'PAID') continue;
      const sid = p.supplierId;
      const linkedDeposit = p.depositId ? deposits.find((d) => d.id === p.depositId) : undefined;
      const collected = linkedDeposit ? D(linkedDeposit.collectedTzs) : 0;
      const fees = D(p.transactionFees) + D(p.bankCharges) + D(p.mobileMoneyCharges) + D(p.agentCommission);
      const profit = collected - D(p.actualCostTzs) - fees;
      const acc = bySupplier[sid] ?? { id: sid, name: p.supplierName, paidTzs: 0, realizedProfit: 0 };
      acc.paidTzs += D(p.actualCostTzs);
      if (linkedDeposit) acc.realizedProfit += profit;
      bySupplier[sid] = acc;
    }

    // Surface allocation count so the dashboard can show "X allocations in flight".
    void allocations;

    return {
      kpis: {
        totalCollected: round(totalCollected),
        totalPaidToSuppliers: round(totalPaidToSuppliers),
        grossProfit: round(grossProfit),
        serviceFees: round(serviceFees),
        exchangeProfit: round(exchangeProfit),
        bankAndMobileCharges: round(bankAndMobileCharges),
        agentCommissions: round(agentCommissions),
        netProfit: round(netProfit),
        realizedProfit: round(realizedProfit),
        projectedProfit: round(projectedProfit),
        pendingPayouts: round(pendingPayouts),
        unassignedFunds: round(unassignedFunds),
        customerCount: customers.length,
        supplierCount: suppliers.length,
      },
      entries,
      daily: buckets('day').slice(-30),
      weekly: buckets('week').slice(-12),
      monthly: buckets('month').slice(-12),
      byCustomer: Object.values(byCustomer).sort((a, b) => b.realizedProfit - a.realizedProfit).slice(0, 20),
      bySupplier: Object.values(bySupplier).sort((a, b) => b.realizedProfit - a.realizedProfit).slice(0, 20),
    };
  }
}

function round(n: number): number {
  return parseFloat(n.toFixed(2));
}
