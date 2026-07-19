import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import {
  Property, PropertyExpense, PropertyLease, PropertyUnit, PropertyVendor, PropertyWorkOrder,
  RentCharge, RentPayment, Tenant,
} from './property.entity';
import { PropertyPaymentToken } from './posys.entity';

// 8-char tokens with BOTH letters and digits, minus ambiguous glyphs
// (0/O, 1/I/L) so they read cleanly off a phone and type easily at a bank.
const TOKEN_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const TOKEN_DIGITS = '23456789';
const TOKEN_ALPHABET = TOKEN_LETTERS + TOKEN_DIGITS;
const TOKEN_LEN = 8;
// A rent token is the tenant's payment id for the whole period, so it lives
// long enough to accept partial payments across weeks (45 days), not minutes.
const TOKEN_TTL_MS = 45 * 24 * 60 * 60 * 1000;

/** 8-char code guaranteed to contain at least one letter and one digit. */
function genTokenCode(): string {
  for (;;) {
    const code = Array.from({ length: TOKEN_LEN }, () => TOKEN_ALPHABET[randomInt(0, TOKEN_ALPHABET.length)]).join('');
    if (/[A-Z]/.test(code) && /[0-9]/.test(code)) return code;
  }
}

export interface BuildingMapUnit {
  id: string;
  label: string;
  unitKind: string;
  tenantId: string | null;
  tenantName: string | null;
  status: 'paid' | 'pending' | 'overdue' | 'vacant' | 'maintenance' | 'partial';
}

export interface BuildingMapCorridor {
  id: string;
  name: string;
  units: BuildingMapUnit[];
}

export interface BuildingMapFloor {
  id: string;
  label: string;
  corridors: BuildingMapCorridor[];
}

export interface BuildingMap {
  propertyId: string;
  propertyName: string;
  floors: BuildingMapFloor[];
}

export interface InsightCard {
  id: string;
  severity: 'high' | 'medium' | 'low' | 'info' | 'opportunity';
  title: string;
  description: string;
  actionLabel?: string;
  entityType?: string;
  entityId?: string;
}

export interface PortfolioHealth {
  healthScore: number;
  collectionRate: number;
  occupancyRate: number;
  expenseRatio: number;
  totalUnits: number;
  occupiedUnits: number;
  monthlyExpected: number;
  monthlyCollected: number;
  monthlyExpenses: number;
}

@Injectable()
export class PosysService {
  constructor(
    @InjectRepository(Property)       private readonly props: Repository<Property>,
    @InjectRepository(PropertyUnit)    private readonly units: Repository<PropertyUnit>,
    @InjectRepository(Tenant)          private readonly tenants: Repository<Tenant>,
    @InjectRepository(PropertyLease)   private readonly leases: Repository<PropertyLease>,
    @InjectRepository(RentPayment)     private readonly payments: Repository<RentPayment>,
    @InjectRepository(PropertyExpense) private readonly expenses: Repository<PropertyExpense>,
    @InjectRepository(PropertyWorkOrder) private readonly workOrders: Repository<PropertyWorkOrder>,
    @InjectRepository(RentCharge)      private readonly charges: Repository<RentCharge>,
    @InjectRepository(PropertyPaymentToken) private readonly tokens: Repository<PropertyPaymentToken>,
    @InjectRepository(PropertyVendor) private readonly vendors: Repository<PropertyVendor>,
  ) {}

  /**
   * Public tenant portal (#11), keyed by a rent token. A tenant scans the
   * estate QR, enters their token, and sees: their rent status for the period,
   * the landlord's team/technician contacts (#10), and the property list.
   * Token-gated — no token, no personal data. Owner-safe (no ids leaked).
   */
  async portalByToken(code: string) {
    const token = await this.tokens.findOne({ where: { code } });
    if (!token) throw new NotFoundException('Token not found');
    const ownerId = token.ownerId;
    const [tenant, unit, vendors, props] = await Promise.all([
      this.tenants.findOne({ where: { id: token.tenantId } }),
      token.unitId ? this.units.findOne({ where: { id: token.unitId } }) : Promise.resolve(null),
      this.vendors.find({ where: { ownerId } }),
      this.props.find({ where: { ownerId } }),
    ]);
    const expected = Number(token.amount);
    const paid = Number(token.usedAmount);
    const expired = token.status === 'ACTIVE' && token.expiresAt.getTime() < Date.now();
    return {
      tenant: {
        name: tenant?.name ?? 'Tenant',
        unitLabel: unit?.unitNumber ?? '',
        status: expired ? 'EXPIRED' : token.status,
        expected,
        paid,
        remaining: Math.max(0, expected - paid),
        currency: token.currency,
        fullyPaid: token.status === 'USED',
      },
      staff: vendors
        .filter((v) => v.name)
        .map((v) => ({ name: v.name, role: v.category, phone: v.phone })),
      properties: props.map((p) => ({ name: p.name, address: p.address })),
    };
  }

  /**
   * Contract-drafting data for the lawyer portal (#8), keyed by a rent token —
   * same access model as the bank page. Returns the tenant, unit, property and
   * rent terms a lawyer needs to fill and print a tenancy agreement.
   */
  async contractByToken(code: string) {
    const token = await this.tokens.findOne({ where: { code } });
    if (!token) throw new NotFoundException('Token not found');
    const tenant = await this.tenants.findOne({ where: { id: token.tenantId } });
    const unit = token.unitId ? await this.units.findOne({ where: { id: token.unitId } }) : null;
    const property = unit?.propertyId ? await this.props.findOne({ where: { id: unit.propertyId } }) : null;
    return {
      tenant: {
        name: tenant?.name ?? '',
        phone: tenant?.phone ?? '',
        leaseStart: tenant?.leaseStart ?? null,
        leaseEnd: tenant?.leaseEnd ?? null,
      },
      unit: { label: unit?.unitNumber ?? '', rent: Number(unit?.rentAmount ?? token.amount) },
      property: { name: property?.name ?? '', address: property?.address ?? '' },
      annualRent: Number(token.amount),
      currency: token.currency,
    };
  }

  // ── Payment tokens ─────────────────────────────────────────────

  /**
   * Tenant generates a token. We retry on collision; alphabet is
   * digits-only so a cashier can type it on a numeric keypad. Lookup
   * also auto-expires stale ACTIVE rows that have aged past the TTL.
   */
  async issueToken(ownerId: string, dto: {
    tenantId: string;
    unitId?: string;
    leaseId?: string;
    amount: number;
    currency?: string;
  }): Promise<PropertyPaymentToken> {
    if (dto.amount <= 0) throw new BadRequestException('amount must be > 0');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    for (let i = 0; i < 6; i++) {
      const code = genTokenCode();
      const exists = await this.tokens.findOne({ where: { code, status: 'ACTIVE' } });
      if (exists) continue;
      return this.tokens.save(this.tokens.create({
        ownerId,
        code,
        tenantId: dto.tenantId,
        unitId: dto.unitId ?? null,
        leaseId: dto.leaseId ?? null,
        amount: dto.amount,
        currency: dto.currency ?? 'TZS',
        status: 'ACTIVE',
        expiresAt,
        usedAmount: 0,
      }));
    }
    throw new BadRequestException('Could not generate a unique token; please retry');
  }

  /**
   * Read-only lookup for the public agent endpoint. Does NOT mutate
   * — so a prefetcher, link-preview crawler, or generic
   * at-least-once retry middleware hitting the URL cannot flip an
   * ACTIVE token to EXPIRED before the cashier's real scan reads it.
   * Callers derive display-side expiry from `expiresAt` vs now.
   */
  async lookupTokenReadOnly(code: string): Promise<PropertyPaymentToken> {
    const row = await this.tokens.findOne({ where: { code } });
    if (!row) throw new NotFoundException('Token not found');
    return row;
  }

  /**
   * Enriched, owner-safe view of a token for the public bank/agent page:
   * the tenant's name (so the clerk confirms who they're collecting for),
   * the expected amount, what's already been paid against this token, and
   * what remains. Never exposes ownerId or internal ids.
   */
  async lookupTokenForAgent(code: string) {
    const row = await this.tokens.findOne({ where: { code } });
    if (!row) throw new NotFoundException('Token not found');
    const tenant = await this.tenants.findOne({ where: { id: row.tenantId } });
    const expired = row.status === 'ACTIVE' && row.expiresAt.getTime() < Date.now();
    const expected = Number(row.amount);
    const paid = Number(row.usedAmount);
    return {
      code: row.code,
      status: expired ? 'EXPIRED' : row.status,
      tenantName: tenant?.name ?? 'Tenant',
      expected,
      paid,
      remaining: Math.max(0, expected - paid),
      currency: row.currency,
      expiresAt: row.expiresAt,
      fullyPaid: row.status === 'USED',
    };
  }

  /**
   * Redeem a token atomically. The transaction opens a
   * `SELECT … FOR UPDATE` row-lock so two concurrent redeems can't
   * both pass the ACTIVE check — the second call sees status='USED'
   * and rejects with "Token is used". Also sweeps EXPIRED here so an
   * expired-past-TTL row is refused inside the same critical section.
   */
  async redeemToken(code: string, dto: { amountReceived: number; agentId?: string }): Promise<{
    code: string;
    status: PropertyPaymentToken['status'];
    expected: number;
    paid: number;
    remaining: number;
    currency: string;
    fullyPaid: boolean;
  }> {
    if (dto.amountReceived <= 0) throw new BadRequestException('amountReceived must be > 0');
    return this.tokens.manager.transaction(async (tx) => {
      const repo = tx.getRepository(PropertyPaymentToken);
      const row = await repo.createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.code = :code', { code })
        .getOne();
      if (!row) throw new NotFoundException('Token not found');
      // Fold expiry-sweep into the same critical section.
      if (row.status === 'ACTIVE' && row.expiresAt.getTime() < Date.now()) {
        row.status = 'EXPIRED';
        await repo.save(row);
        throw new BadRequestException('Token is expired');
      }
      if (row.status !== 'ACTIVE') throw new BadRequestException(`Token is ${row.status.toLowerCase()}`);

      // Accumulate — a half payment leaves the SAME token ACTIVE so the tenant
      // completes it later with the same code. The token only closes (USED)
      // once the total received reaches the expected amount.
      row.usedAmount = Number(row.usedAmount) + dto.amountReceived;
      row.usedAt = new Date();
      row.agentId = dto.agentId ?? null;
      const expected = Number(row.amount);
      const fullyPaid = row.usedAmount >= expected;
      if (fullyPaid) row.status = 'USED';
      await repo.save(row);

      // Record the actual money received as a RentPayment. Entering the token
      // is the ONLY path that records rent — no token, no payment. unitId is
      // required on a payment, so fall back to the tenant's unit when the token
      // wasn't tied to one.
      let unitId = row.unitId ?? null;
      if (!unitId) {
        const tenant = await tx.getRepository(Tenant).findOne({ where: { id: row.tenantId } });
        unitId = tenant?.unitId ?? null;
      }
      if (unitId) {
        const payRepo = tx.getRepository(RentPayment);
        const now = new Date();
        await payRepo.save(payRepo.create({
          ownerId: row.ownerId,
          tenantId: row.tenantId,
          unitId,
          amount: dto.amountReceived,
          currency: row.currency,
          forMonth: new Date(now.getFullYear(), now.getMonth(), 1),
          paidAt: now,
          method: 'TOKEN',
          reference: row.code,
        }));
      }

      return {
        code: row.code,
        status: row.status,
        expected,
        paid: row.usedAmount,
        remaining: Math.max(0, expected - row.usedAmount),
        currency: row.currency,
        fullyPaid,
      };
    });
  }

  // ── Rent dashboard (#2): collected vs expected + monthly breakdown ──────

  /** Month key like "2026-07" from a Date. */
  private monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /** The month a payment applies to (its billing month, else when it was paid). */
  private paymentMonth(p: RentPayment): string {
    return this.monthKey(new Date(p.forMonth ?? p.paidAt));
  }

  /**
   * Collected-vs-expected rollup for the owner's portfolio. Expected rent is
   * the sum of unit rents (per month); collected is the sum of recorded
   * payments (which now only come from redeemed tokens). Returns the last 6
   * months and a per-property breakdown so the UI can drill in.
   */
  async rentDashboard(ownerId: string) {
    const [props, units, payments] = await Promise.all([
      this.props.find({ where: { ownerId } }),
      this.units.find({ where: { ownerId } }),
      this.payments.find({ where: { ownerId } }),
    ]);

    const monthlyExpected = units.reduce((s, u) => s + Number(u.rentAmount || 0), 0);
    const now = new Date();
    const thisKey = this.monthKey(now);

    const months: Array<{ period: string; label: string; expected: number; collected: number; pending: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = this.monthKey(d);
      const collected = payments
        .filter((p) => this.paymentMonth(p) === key)
        .reduce((s, p) => s + Number(p.amount), 0);
      months.push({
        period: key,
        label: d.toLocaleString('en', { month: 'short', year: '2-digit' }),
        expected: monthlyExpected,
        collected,
        pending: Math.max(0, monthlyExpected - collected),
      });
    }

    const collectedThisMonth = payments
      .filter((p) => this.paymentMonth(p) === thisKey)
      .reduce((s, p) => s + Number(p.amount), 0);

    const properties = props.map((pr) => {
      const punits = units.filter((u) => u.propertyId === pr.id);
      const expected = punits.reduce((s, u) => s + Number(u.rentAmount || 0), 0);
      const unitIds = new Set(punits.map((u) => u.id));
      const collected = payments
        .filter((p) => p.unitId && unitIds.has(p.unitId) && this.paymentMonth(p) === thisKey)
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        propertyId: pr.id,
        name: pr.name,
        units: punits.length,
        expected,
        collected,
        pending: Math.max(0, expected - collected),
      };
    });

    return {
      currency: 'TZS',
      expectedMonthly: monthlyExpected,
      collectedThisMonth,
      pendingThisMonth: Math.max(0, monthlyExpected - collectedThisMonth),
      collectionRate: monthlyExpected > 0 ? Math.round((collectedThisMonth / monthlyExpected) * 100) : 0,
      months,
      properties,
    };
  }

  /**
   * Tenants with rent still owing — the drill-down behind "pending". Computes
   * this-month shortfall and, from lease start, how many whole months they're
   * behind. Includes phone so the UI can fire a WhatsApp reminder.
   */
  async pendingTenants(ownerId: string) {
    const [units, tenants, payments] = await Promise.all([
      this.units.find({ where: { ownerId } }),
      this.tenants.find({ where: { ownerId } }),
      this.payments.find({ where: { ownerId } }),
    ]);
    const unitById = new Map(units.map((u) => [u.id, u]));
    const now = new Date();
    const thisKey = this.monthKey(now);

    const rows = tenants.map((t) => {
      const unit = t.unitId ? unitById.get(t.unitId) : undefined;
      const rent = unit ? Number(unit.rentAmount || 0) : 0;

      const paidThisMonth = payments
        .filter((p) => p.tenantId === t.id && this.paymentMonth(p) === thisKey)
        .reduce((s, p) => s + Number(p.amount), 0);
      const pendingThisMonth = Math.max(0, rent - paidThisMonth);

      const start = t.leaseStart ? new Date(t.leaseStart) : null;
      const monthsElapsed = start && !isNaN(start.getTime())
        ? Math.max(1, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1)
        : 1;
      const totalExpected = rent * monthsElapsed;
      const totalPaid = payments
        .filter((p) => p.tenantId === t.id)
        .reduce((s, p) => s + Number(p.amount), 0);
      const totalPending = Math.max(0, totalExpected - totalPaid);
      const monthsDue = rent > 0 ? Math.floor(totalPending / rent) : 0;

      return {
        tenantId: t.id,
        name: t.name,
        phone: t.phone ?? '',
        unitLabel: unit?.unitNumber ?? '',
        rent,
        pendingThisMonth,
        totalPending,
        monthsDue,
      };
    }).filter((r) => r.totalPending > 0);

    rows.sort((a, b) => b.totalPending - a.totalPending);
    return rows;
  }

  async cancelToken(ownerId: string, id: string): Promise<PropertyPaymentToken> {
    const row = await this.tokens.findOne({ where: { id, ownerId } });
    if (!row) throw new NotFoundException();
    if (row.status !== 'ACTIVE') return row;
    row.status = 'CANCELLED';
    return this.tokens.save(row);
  }

  async listTokens(ownerId: string) {
    // Sweep obviously-stale ACTIVE rows up to the caller's view before
    // returning results. Previously used `void update` which lost the
    // race with the SELECT and returned rows still marked ACTIVE.
    await this.tokens.update(
      { ownerId, status: 'ACTIVE', expiresAt: LessThan(new Date()) },
      { status: 'EXPIRED' },
    );
    return this.tokens.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 50 });
  }

  // ── Building map ───────────────────────────────────────────────

  /**
   * Group a property's units into floors → corridors → units. The unit
   * entity stores `floor` as a string and `unitNumber` like "A1" /
   * "B12"; the alphabetic prefix becomes the corridor name so the
   * frontend can lay them out without a schema migration.
   */
  async buildingMap(ownerId: string, propertyId: string): Promise<BuildingMap> {
    const prop = await this.props.findOne({ where: { id: propertyId, ownerId } });
    if (!prop) throw new NotFoundException('Property not found');
    const [units, leases, payments] = await Promise.all([
      this.units.find({ where: { ownerId, propertyId } }),
      this.leases.find({ where: { ownerId } }),
      this.payments.find({ where: { ownerId } }),
    ]);

    // Index leases by unit + by tenant for quick lookup.
    const leaseByUnit = new Map<string, PropertyLease>();
    for (const l of leases) if (l.unitId) leaseByUnit.set(l.unitId, l);

    // Sum of payments per unit this calendar month. RentPayment is
    // keyed by unitId (no direct leaseId), so unit-level grouping is
    // the right scope for "did this unit's tenant pay this month".
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const paidThisMonthByUnit = new Map<string, number>();
    for (const p of payments) {
      if (!p.unitId) continue;
      const dt = new Date(p.paidAt ?? p.createdAt);
      if (dt.getTime() < monthStart.getTime()) continue;
      paidThisMonthByUnit.set(p.unitId, (paidThisMonthByUnit.get(p.unitId) ?? 0) + Number(p.amount));
    }

    const floorMap = new Map<string, Map<string, BuildingMapUnit[]>>();
    for (const u of units) {
      const floor = u.floor || 'Ground Floor';
      const corridor = pickCorridor(u.unitNumber);
      const lease = leaseByUnit.get(u.id);
      const tenant = lease ? await this.tenantById(lease.tenantId, ownerId) : null;
      const status = computeUnitStatus(u, lease, paidThisMonthByUnit.get(u.id) ?? 0);

      const corridors = floorMap.get(floor) ?? new Map();
      const arr = corridors.get(corridor) ?? [];
      arr.push({
        id: u.id,
        label: u.unitNumber,
        unitKind: u.type,
        tenantId: tenant?.id ?? null,
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : null,
        status,
      });
      corridors.set(corridor, arr);
      floorMap.set(floor, corridors);
    }

    const floors: BuildingMapFloor[] = Array.from(floorMap.entries()).map(([label, corridors]) => ({
      id: label,
      label,
      corridors: Array.from(corridors.entries()).map(([name, arr]) => ({
        id: `${label}-${name}`,
        name: `Corridor ${name}`,
        units: arr.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
      })),
    }));

    return { propertyId: prop.id, propertyName: prop.name, floors };
  }

  private async tenantById(id: string, ownerId: string): Promise<Tenant | null> {
    return this.tenants.findOne({ where: { id, ownerId } });
  }

  // ── Portfolio health + insights ────────────────────────────────

  async portfolioHealth(ownerId: string): Promise<PortfolioHealth> {
    const [units, leases, payments, expenses] = await Promise.all([
      this.units.find({ where: { ownerId } }),
      this.leases.find({ where: { ownerId, status: 'active' } }),
      this.payments.find({ where: { ownerId } }),
      this.expenses.find({ where: { ownerId } }),
    ]);

    const totalUnits = units.length;
    const occupiedUnits = leases.length;

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthlyExpected = leases.reduce((s, l) => s + Number(l.monthlyRent ?? 0), 0);
    const monthlyCollected = payments
      .filter((p) => new Date(p.paidAt ?? p.createdAt).getTime() >= monthStart.getTime())
      .reduce((s, p) => s + Number(p.amount), 0);
    const monthlyExpenses = expenses
      .filter((e) => new Date(e.spentAt ?? e.createdAt).getTime() >= monthStart.getTime())
      .reduce((s, e) => s + Number(e.amount), 0);

    const collectionRate = monthlyExpected > 0 ? Math.round((monthlyCollected / monthlyExpected) * 100) : 0;
    const occupancyRate  = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const expenseRatio   = monthlyExpected > 0 ? Math.round((monthlyExpenses / monthlyExpected) * 100) : 0;

    // Health score = weighted blend; expense ratio is inverted (lower = better).
    const healthScore = Math.max(0, Math.min(100, Math.round(
      collectionRate * 0.45 +
      occupancyRate  * 0.35 +
      (100 - expenseRatio) * 0.20,
    )));

    return {
      healthScore, collectionRate, occupancyRate, expenseRatio,
      totalUnits, occupiedUnits,
      monthlyExpected, monthlyCollected, monthlyExpenses,
    };
  }

  async insights(ownerId: string): Promise<InsightCard[]> {
    const [units, leases, payments, expenses, workOrders] = await Promise.all([
      this.units.find({ where: { ownerId } }),
      this.leases.find({ where: { ownerId } }),
      this.payments.find({ where: { ownerId } }),
      this.expenses.find({ where: { ownerId } }),
      this.workOrders.find({ where: { ownerId } }),
    ]);

    const out: InsightCard[] = [];
    const now = Date.now();

    // 1. Overdue leases (active, no payment in 35+ days).
    // Payments are keyed by unitId, so group by unit + match to lease.
    const recentPaymentByUnit = new Map<string, number>();
    for (const p of payments) {
      if (!p.unitId) continue;
      const t = new Date(p.paidAt ?? p.createdAt).getTime();
      const cur = recentPaymentByUnit.get(p.unitId) ?? 0;
      if (t > cur) recentPaymentByUnit.set(p.unitId, t);
    }
    const overdue = leases.filter((l) => {
      if (l.status !== 'active' || !l.unitId) return false;
      const last = recentPaymentByUnit.get(l.unitId);
      // Overdue also covers the never-paid case: a fresh active lease
      // that hasn't received a payment in 35+ days since it started.
      // Previously `last > 0 && ...` silently dropped exactly the
      // tenants most worth chasing.
      if (last == null) {
        const started = new Date(l.startDate).getTime();
        return started > 0 && (now - started) > 35 * 86400_000;
      }
      return (now - last) > 35 * 86400_000;
    });
    if (overdue.length > 0) {
      out.push({
        id: 'overdue', severity: 'high',
        title: `${overdue.length} tenant${overdue.length > 1 ? 's' : ''} overdue 35+ days`,
        description: 'Pending leases without a fresh payment. Send a reminder or schedule a visit.',
        actionLabel: 'Open tenants',
      });
    }

    // 2. Expiring contracts within 60 days
    const expiringSoon = leases.filter((l) => {
      if (l.status !== 'active' || !l.endDate) return false;
      const d = new Date(l.endDate).getTime() - now;
      return d > 0 && d < 60 * 86400_000;
    });
    if (expiringSoon.length > 0) {
      out.push({
        id: 'expiring', severity: 'medium',
        title: `${expiringSoon.length} lease${expiringSoon.length > 1 ? 's' : ''} expiring within 60 days`,
        description: 'Open the lease record to extend, renegotiate, or schedule a move-out.',
        actionLabel: 'Review leases',
      });
    }

    // 3. Recurring maintenance (3+ work orders on same unit in 90 days)
    const ninetyAgo = now - 90 * 86400_000;
    const byUnit = new Map<string, number>();
    for (const w of workOrders) {
      if (new Date(w.createdAt).getTime() < ninetyAgo) continue;
      byUnit.set(w.unitId ?? '', (byUnit.get(w.unitId ?? '') ?? 0) + 1);
    }
    for (const [unitId, count] of byUnit.entries()) {
      if (count < 3) continue;
      const u = units.find((x) => x.id === unitId);
      if (!u) continue;
      out.push({
        id: `recur-${unitId}`, severity: 'medium',
        title: `Maintenance recurrence on ${u.unitNumber}`,
        description: `${count} work orders in the last 90 days. Worth a full inspection.`,
        actionLabel: 'Schedule visit', entityType: 'unit', entityId: unitId,
      });
    }

    // 4. Vacant units > 30 days (opportunity)
    const vacantUnits = units.filter((u) => u.status === 'vacant');
    if (vacantUnits.length > 0) {
      out.push({
        id: 'vacancy', severity: 'opportunity',
        title: `${vacantUnits.length} vacant unit${vacantUnits.length > 1 ? 's' : ''} ready to list`,
        description: 'Run a rent simulation or invite a tenant directly from the listing.',
        actionLabel: 'Run simulation',
      });
    }

    // 5. Recurring expenses spent in the last 7 days (so the operator
    // can spot accelerating cost trends from the Insights view).
    const sevenAgo = now - 7 * 86400_000;
    const dueSoon = expenses.filter((e) => {
      const t = new Date(e.spentAt ?? e.createdAt).getTime();
      return t >= sevenAgo && t <= now;
    });
    if (dueSoon.length > 0) {
      out.push({
        id: 'expense-recent', severity: 'info',
        title: `${dueSoon.length} expense${dueSoon.length > 1 ? 's' : ''} logged this week`,
        description: `Total ${Math.round(dueSoon.reduce((s, e) => s + Number(e.amount), 0)).toLocaleString()} across utilities and services.`,
        actionLabel: 'Open expenses',
      });
    }

    // Silence unused-import warning when no insight uses charges yet.
    void this.charges;

    return out;
  }

  /** Rent-increase simulation pure function — usable from a controller. */
  simulate(unitCount: number, currentMonthlyRevenue: number, increasePct: number) {
    const projected = currentMonthlyRevenue * (1 + increasePct / 100);
    const delta = projected - currentMonthlyRevenue;
    const churnProb = Math.min(1, Math.max(0, (increasePct - 5) / 30));
    const expectedChurn = Math.round(unitCount * churnProb);
    const retained = unitCount - expectedChurn;
    const expectedRetentionPct = unitCount > 0 ? Math.round((retained / unitCount) * 100) : 100;
    const expectedNet = projected * (retained / Math.max(1, unitCount));
    const riskBand: 'Low' | 'Moderate' | 'High' =
      increasePct <= 8 ? 'Low' : increasePct <= 15 ? 'Moderate' : 'High';
    const recommendation =
      increasePct <= 5 ? 'Safe to roll out across the portfolio.' :
      increasePct <= 12 ? 'Phase-in moderate-risk tenants over 60 days for best retention.' :
      'High churn likelihood — consider targeting only high-margin or new tenants.';
    return {
      currentMonthlyRevenue, projected, delta,
      expectedChurn, retained, expectedRetentionPct, expectedNet,
      riskBand, recommendation,
    };
  }
}

/* ── helpers ─────────────────────────────────────────────────────── */

function pickCorridor(unitNumber: string): string {
  const m = /^([A-Za-z]+)/.exec(unitNumber);
  if (m) return m[1].toUpperCase();
  // Numeric-only — bucket into "A" so the unit still shows up.
  return 'A';
}

function computeUnitStatus(
  unit: PropertyUnit, lease: PropertyLease | undefined, paidThisMonth: number,
): BuildingMapUnit['status'] {
  if (unit.status === 'maintenance') return 'maintenance';
  if (unit.status === 'vacant' || !lease) return 'vacant';
  const monthly = Number(lease.monthlyRent ?? 0);
  if (monthly === 0) return 'pending';
  if (paidThisMonth >= monthly)         return 'paid';
  if (paidThisMonth > 0)                 return 'partial';
  // Active lease, no payment this month — past due if we're past the 5th.
  if (new Date().getDate() > 5)          return 'overdue';
  return 'pending';
}
