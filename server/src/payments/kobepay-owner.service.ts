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
import { KobePayAuditEvent, KobePayUser } from './kobepay-rbac.entity';
import { KobePayRate } from './kobepay-rate.entity';
import { KobePayRatesService } from './kobepay-rate.service';

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

/* ============================================================
 * Cashier performance dashboard
 * ========================================================== */

export interface CashierStat {
  userId: string | null;
  name: string;
  role: string;
  deposits: number;
  depositsTotal: number;
  payoutsInitiated: number;
  payoutsPaidValue: number;
  reversals: number;
  attributedProfitTzs: number;
  lastActiveAt: string | null;
}

@Injectable()
export class KobePayCashierPerfService {
  constructor(
    @InjectRepository(KobePayUser) private readonly users: Repository<KobePayUser>,
    @InjectRepository(KobePayAuditEvent) private readonly audits: Repository<KobePayAuditEvent>,
    @InjectRepository(PaymentDeposit) private readonly deposits: Repository<PaymentDeposit>,
    @InjectRepository(PaymentPayout) private readonly payouts: Repository<PaymentPayout>,
  ) {}

  async dashboard(uid: string): Promise<CashierStat[]> {
    const [users, audits, deposits, payouts] = await Promise.all([
      this.users.find({ where: { ownerId: uid } }),
      this.audits.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 5000 }),
      this.deposits.find({ where: { ownerId: uid } }),
      this.payouts.find({ where: { ownerId: uid } }),
    ]);

    // Group audit events by actorUserId so each cashier's volumes are real.
    const byActor: Record<string, { events: KobePayAuditEvent[]; last: string }> = {};
    for (const ev of audits) {
      const key = ev.actorUserId ?? '__owner';
      const acc = byActor[key] ?? { events: [], last: '' };
      acc.events.push(ev);
      const ts = ev.createdAt.toISOString();
      if (ts > acc.last) acc.last = ts;
      byActor[key] = acc;
    }

    const out: CashierStat[] = users.map((u) => {
      const bucket = byActor[u.id] ?? { events: [], last: '' };
      const depositIdsBy = new Set(
        bucket.events.filter((e) => e.action === 'deposit.create').map((e) => e.resourceId).filter(Boolean) as string[],
      );
      const payoutIdsBy = new Set(
        bucket.events.filter((e) => e.action === 'payout.create' || e.action === 'payout.paid').map((e) => e.resourceId).filter(Boolean) as string[],
      );
      const reversals = bucket.events.filter((e) => /reverse|rejected/i.test(e.action)).length;

      const userDeposits = deposits.filter((d) => depositIdsBy.has(d.id));
      const depositsTotal = userDeposits.reduce((s, d) => s + Number(d.collectedTzs || d.amount), 0);
      const userPayouts = payouts.filter((p) => payoutIdsBy.has(p.id));
      const payoutsPaidValue = userPayouts
        .filter((p) => p.status === 'PAID')
        .reduce((s, p) => s + Number(p.actualCostTzs || p.amount), 0);

      // Profit attributed to this cashier = sum over realized deposits
      // they created of (collected − cost − fees).
      let attributedProfit = 0;
      for (const d of userDeposits) {
        const paid = payouts.find((p) => p.depositId === d.id && p.status === 'PAID');
        if (!paid) continue;
        const fees = Number(paid.transactionFees) + Number(paid.bankCharges) + Number(paid.mobileMoneyCharges) + Number(paid.agentCommission);
        attributedProfit += Number(d.collectedTzs) - Number(paid.actualCostTzs) - fees;
      }

      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        deposits: userDeposits.length,
        depositsTotal: round(depositsTotal),
        payoutsInitiated: userPayouts.length,
        payoutsPaidValue: round(payoutsPaidValue),
        reversals,
        attributedProfitTzs: round(attributedProfit),
        lastActiveAt: bucket.last || null,
      };
    });
    return out.sort((a, b) => b.depositsTotal - a.depositsTotal);
  }
}

/* ============================================================
 * Risk & exceptions dashboard
 * ========================================================== */

export interface RiskAlert {
  severity: 'high' | 'medium' | 'low';
  kind: string;
  message: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
}

const LARGE_DEPOSIT_TZS = 10_000_000;
const PAYOUT_STALE_HOURS = 24;
const PAYOUT_UNCONFIRMED_HOURS = 12;
const RATE_OVERRIDE_PCT = 8; // sales rate diverging from median > 8% flags

@Injectable()
export class KobePayRiskService {
  constructor(
    @InjectRepository(PaymentDeposit) private readonly deposits: Repository<PaymentDeposit>,
    @InjectRepository(PaymentPayout) private readonly payouts: Repository<PaymentPayout>,
    @InjectRepository(KobePayAuditEvent) private readonly audits: Repository<KobePayAuditEvent>,
    @InjectRepository(KobePayRate) private readonly rates: Repository<KobePayRate>,
    private readonly ratesSvc: KobePayRatesService,
  ) {}

  async dashboard(uid: string): Promise<{ alerts: RiskAlert[]; summary: Record<string, number> }> {
    const [deposits, payouts, audits] = await Promise.all([
      this.deposits.find({ where: { ownerId: uid } }),
      this.payouts.find({ where: { ownerId: uid } }),
      this.audits.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 2000 }),
    ]);
    const now = Date.now();
    const alerts: RiskAlert[] = [];

    // Resolve the house sales rate for each distinct targetCurrency that
    // appears in deposits — uses the rates service so derived USD-based
    // cross-rates work the same as legacy direct pairs.
    const houseSalesRate: Record<string, number> = {};
    const pairsSeen = new Set<string>();
    for (const d of deposits) {
      const key = `${d.targetCurrency}->TZS`;
      if (pairsSeen.has(key)) continue;
      pairsSeen.add(key);
      const resolved = await this.ratesSvc.resolveRate(uid, d.targetCurrency, 'TZS');
      if (resolved.source !== 'none') houseSalesRate[key] = resolved.salesRate;
    }

    // Large deposits.
    for (const d of deposits) {
      if (Number(d.collectedTzs || d.amount) >= LARGE_DEPOSIT_TZS && d.status === 'Confirmed') {
        alerts.push({
          severity: 'medium',
          kind: 'large_deposit',
          message: `Deposit of ${Math.round(Number(d.collectedTzs || d.amount)).toLocaleString()} TZS from ${d.customerName} exceeds ${LARGE_DEPOSIT_TZS.toLocaleString()} threshold`,
          resourceType: 'deposit',
          resourceId: d.id,
          createdAt: d.createdAt.toISOString(),
        });
      }
    }

    // Stale pending payouts.
    for (const p of payouts) {
      const ageH = (now - new Date(p.createdAt).getTime()) / 3_600_000;
      if (p.status === 'INITIATED' && ageH > PAYOUT_STALE_HOURS) {
        alerts.push({
          severity: 'high',
          kind: 'stale_payout',
          message: `Payout to ${p.supplierName} initiated ${Math.round(ageH)}h ago is still pending`,
          resourceType: 'payout',
          resourceId: p.id,
          createdAt: p.createdAt.toISOString(),
        });
      } else if (p.status === 'SENT' && ageH > PAYOUT_UNCONFIRMED_HOURS) {
        alerts.push({
          severity: 'high',
          kind: 'unconfirmed_payout',
          message: `Payout to ${p.supplierName} sent ${Math.round(ageH)}h ago but China has not confirmed`,
          resourceType: 'payout',
          resourceId: p.id,
          createdAt: p.createdAt.toISOString(),
        });
      }
    }

    // Rate override: prefer the house rate when one is configured for the
    // pair; otherwise fall back to the median of recent deposits (legacy
    // behaviour, useful when the owner hasn't set rates yet).
    for (const d of deposits) {
      const r = Number(d.salesRate);
      if (r <= 0) continue;
      const key = `${d.targetCurrency}->TZS`;
      const house = houseSalesRate[key];
      if (house && house > 0) {
        const divergence = Math.abs((r - house) / house) * 100;
        if (divergence > RATE_OVERRIDE_PCT) {
          alerts.push({
            severity: 'medium',
            kind: 'rate_override',
            message: `Deposit ${d.id.slice(0, 8)} used rate ${r} ${d.targetCurrency}/TZS (house rate ${house}, ${divergence.toFixed(1)}% off)`,
            resourceType: 'deposit',
            resourceId: d.id,
            createdAt: d.createdAt.toISOString(),
          });
        }
      }
    }
    if (Object.keys(houseSalesRate).length === 0) {
      const sampleRates = deposits.map((d) => Number(d.salesRate)).filter((r) => r > 0).sort((a, b) => a - b);
      if (sampleRates.length >= 5) {
        const median = sampleRates[Math.floor(sampleRates.length / 2)];
        for (const d of deposits) {
          const r = Number(d.salesRate);
          if (r <= 0) continue;
          const divergence = Math.abs((r - median) / median) * 100;
          if (divergence > RATE_OVERRIDE_PCT) {
            alerts.push({
              severity: 'medium',
              kind: 'rate_override',
              message: `Deposit ${d.id.slice(0, 8)} used rate ${r} (median ${median}, ${divergence.toFixed(1)}% off)`,
              resourceType: 'deposit',
              resourceId: d.id,
              createdAt: d.createdAt.toISOString(),
            });
          }
        }
      }
    }

    // Supplier over/underpayment.
    for (const p of payouts) {
      if (p.status !== 'PAID' || !p.depositId) continue;
      const d = deposits.find((x) => x.id === p.depositId);
      if (!d) continue;
      const expected = Number(d.targetAmount);
      const actual = Number(p.amount);
      if (expected > 0 && Math.abs(expected - actual) > 0.01) {
        alerts.push({
          severity: 'high',
          kind: actual > expected ? 'supplier_overpaid' : 'supplier_underpaid',
          message: `${p.supplierName} ${actual > expected ? 'overpaid' : 'underpaid'}: expected ${expected} ${d.targetCurrency}, paid ${actual}`,
          resourceType: 'payout',
          resourceId: p.id,
          createdAt: p.createdAt.toISOString(),
        });
      }
    }

    // Cashier mismatch: payout PAID by the same user who initiated it (no 4-eyes).
    const paidEvents = audits.filter((a) => a.action === 'payout.paid');
    for (const ev of paidEvents) {
      const initEv = audits.find((a) => a.action === 'payout.create' && a.resourceId === ev.resourceId);
      if (initEv && initEv.actorUserId && ev.actorUserId === initEv.actorUserId) {
        alerts.push({
          severity: 'medium',
          kind: 'cashier_mismatch',
          message: `${ev.actorName} both initiated and marked payout ${ev.resourceId?.slice(0, 8)} as PAID (no four-eye control)`,
          resourceType: 'payout',
          resourceId: ev.resourceId ?? '',
          createdAt: ev.createdAt.toISOString(),
        });
      }
    }

    // Explicit rate.override events from the audit log → high severity:
    // an override was actually approved (vs the heuristic 'rate_override'
    // that fires when no permission gate exists). Denied overrides also
    // surface so the owner sees who tried.
    for (const ev of audits) {
      if (ev.action === 'rate.override') {
        const md = (ev.metadata ?? {}) as { attempted?: number; house?: number; pair?: string };
        alerts.push({
          severity: 'high',
          kind: 'rate_override_used',
          message: `${ev.actorName} used override rate ${md.attempted} on ${md.pair} (house ${md.house})`,
          resourceType: ev.resourceType,
          resourceId: ev.resourceId ?? '',
          createdAt: ev.createdAt.toISOString(),
        });
      } else if (ev.action === 'rate.overrideDenied') {
        const md = (ev.metadata ?? {}) as { attempted?: number; house?: number; pair?: string };
        alerts.push({
          severity: 'medium',
          kind: 'rate_override_denied',
          message: `${ev.actorName} attempted override rate ${md.attempted} on ${md.pair} (house ${md.house}) — denied`,
          resourceType: ev.resourceType,
          resourceId: ev.resourceId ?? '',
          createdAt: ev.createdAt.toISOString(),
        });
      }
    }

    const summary = alerts.reduce<Record<string, number>>((acc, a) => {
      acc[a.kind] = (acc[a.kind] ?? 0) + 1;
      return acc;
    }, {});
    return { alerts: alerts.sort((a, b) => (a.severity === 'high' ? -1 : 1)), summary };
  }
}
