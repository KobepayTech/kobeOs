import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Property, PropertyExpense, PropertyLease, PropertyUnit, PropertyWorkOrder, RentCharge, RentPayment, Tenant } from './property.entity';
import { scheduledCharge } from './services/rent-schedule';
import { PropertyAsset, PropertyDepositEntry, PropertyUtilityBill } from './property-intelligence.entity';

export const rounded = (value: number) => Math.round(value * 10000) / 10000;
export function monthBounds(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('Use YYYY-MM.');
  const start = new Date(`${period}-01T00:00:00Z`);
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}
export function periodOffset(period: string, offset: number) {
  const { start } = monthBounds(period); start.setUTCMonth(start.getUTCMonth() + offset); return start.toISOString().slice(0, 7);
}
export function maintenanceRisk(asset: { lastServiced: string; intervalDays: number }, repeatTickets: number, now = new Date()) {
  const dueAt = new Date(new Date(asset.lastServiced).getTime() + asset.intervalDays * 86400000);
  const overdueDays = Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / 86400000));
  return { dueAt: dueAt.toISOString().slice(0, 10), overdueDays, priority: overdueDays > 30 || repeatTickets >= 3 ? 'high' : dueAt.getTime() <= now.getTime() + 7 * 86400000 ? 'normal' : 'low', reason: `${overdueDays} day(s) overdue; ${repeatTickets} recent unit tickets`, method: 'Service interval and 90-day incident count; not a sensor failure prediction' };
}
@Injectable()
export class PropertyInsightsService {
  constructor(private readonly ds: DataSource) {}
  async snapshot(ownerId: string, propertyId?: string, period = new Date().toISOString().slice(0, 7)) {
    const { start, end } = monthBounds(period);
    const properties = await this.ds.getRepository(Property).find({ where: { ownerId, ...(propertyId ? { id: propertyId } : {}) } });
    if (propertyId && !properties.length) throw new NotFoundException('Property not found');
    const units = properties.length ? await this.ds.getRepository(PropertyUnit).find({ where: { ownerId, propertyId: In(properties.map(p => p.id)) } }) : [];
    const ids = units.map(u => u.id); const map = new Map(units.map(u => [u.id, u]));
    const [leases, charges, payments, expenses, tenants, workOrders, assets, utilityBills, deposits] = await Promise.all([
      ids.length ? this.ds.getRepository(PropertyLease).find({ where: { ownerId, unitId: In(ids) } }) : [],
      ids.length ? this.ds.getRepository(RentCharge).find({ where: { ownerId, unitId: In(ids) } }) : [],
      ids.length ? this.ds.getRepository(RentPayment).find({ where: { ownerId, unitId: In(ids) } }) : [],
      this.ds.getRepository(PropertyExpense).find({ where: { ownerId } }),
      this.ds.getRepository(Tenant).find({ where: { ownerId } }),
      this.ds.getRepository(PropertyWorkOrder).find({ where: { ownerId } }),
      this.ds.getRepository(PropertyAsset).find({ where: { ownerId } }),
      ids.length ? this.ds.getRepository(PropertyUtilityBill).find({ where: { ownerId, unitId: In(ids) } }) : [],
      this.ds.getRepository(PropertyDepositEntry).find({ where: { ownerId } }),
    ]);
    const propertyIds = new Set(properties.map(p => p.id));
    const inScopeExpenses = expenses.filter(e => e.propertyId ? propertyIds.has(e.propertyId) : !!e.unitId && map.has(e.unitId));
    const scopedWork = workOrders.filter(w => w.propertyId ? propertyIds.has(w.propertyId) : !!w.unitId && map.has(w.unitId));
    const inPeriod = (d: Date | string) => new Date(d) >= start && new Date(d) < end;
    const sums = new Map<string, { currency: string; billed: number; collected: number; earnedRent: number; expenses: number; arrears: number; cashNet: number; operatingProfit: number }>();
    const bucket = (currency: string) => { if (!sums.has(currency)) sums.set(currency, { currency, billed: 0, collected: 0, earnedRent: 0, expenses: 0, arrears: 0, cashNet: 0, operatingProfit: 0 }); return sums.get(currency)!; };
    for (const c of charges) {
      if (c.status === 'waived') continue;
      const b = bucket(map.get(c.unitId)!.currency);
      if (c.period === period) b.billed += Number(c.amount);
      if (new Date(c.dueDate) < new Date()) b.arrears += Math.max(0, Number(c.amount) - Number(c.amountPaid));
    }
    for (const p of payments) if (inPeriod(p.paidAt)) bucket(p.currency).collected += Number(p.amount);
    for (const e of inScopeExpenses) if (inPeriod(e.spentAt)) bucket(e.currency).expenses += Number(e.amount);
    // Calendar-month recognition, prorated by occupied lease days, separate from advance cash collection.
    for (const l of leases.filter(l => ['active', 'ended', 'upcoming'].includes(l.status))) {
      const overlap = Math.max(0, Math.min(end.getTime(), new Date(l.endDate).getTime()) - Math.max(start.getTime(), new Date(l.startDate).getTime()));
      bucket(map.get(l.unitId)!.currency).earnedRent += Number(l.monthlyRent) * overlap / (end.getTime() - start.getTime());
    }
    for (const b of sums.values()) { b.cashNet = b.collected - b.expenses; b.operatingProfit = b.earnedRent - b.expenses; for (const k of Object.keys(b)) if (k !== 'currency') (b as unknown as Record<string, unknown>)[k] = rounded(Number((b as unknown as Record<string, unknown>)[k])); }
    const discrepancies: Array<{ kind: string; id: string; message: string }> = [];
    for (const c of charges) { const paid = payments.filter(p => p.chargeId === c.id).reduce((n, p) => n + Number(p.amount), 0); if (Math.abs(paid - Number(c.amountPaid)) > 0.0001) discrepancies.push({ kind: 'allocation_mismatch', id: c.id, message: `Charge paid ${c.amountPaid}; payment records ${rounded(paid)}` }); }
    for (const p of payments) if (!p.chargeId || !charges.some(c => c.id === p.chargeId)) discrepancies.push({ kind: 'unallocated_payment', id: p.id, message: 'Payment has no matching charge' });
    const seen = new Set<string>();
    for (const p of payments) if (p.reference) { const key = `${p.method}:${p.reference}`; if (seen.has(key)) discrepancies.push({ kind: 'duplicate_reference', id: p.id, message: `Review repeated reference ${p.reference}` }); seen.add(key); }
    const forecast = Array.from({ length: 12 }, (_, i) => {
      const forecastPeriod = periodOffset(period, i + 1); const currencies: Record<string, number> = {};
      for (const l of leases.filter(l => ['active', 'upcoming'].includes(l.status))) { const s = scheduledCharge(l, forecastPeriod); if (s) { const c = map.get(l.unitId)!.currency; currencies[c] = rounded((currencies[c] || 0) + s.amount); } }
      return { period: forecastPeriod, scheduledRent: currencies };
    });
    const maintenance = assets.filter(a => propertyIds.has(a.propertyId)).map(a => ({ ...a, ...maintenanceRisk(a, scopedWork.filter(w => a.unitId && w.unitId === a.unitId && new Date(w.createdAt).getTime() > Date.now() - 90 * 86400000).length) }));
    return { generatedAt: new Date().toISOString(), period, properties, units, tenants: tenants.filter(t => t.unitId && map.has(t.unitId)), leases, charges, payments, expenses: inScopeExpenses, utilityBills, deposits: deposits.filter(d => leases.some(l => l.id === d.leaseId)), workOrders: scopedWork, occupancy: { total: units.length, occupied: units.filter(u => u.status === 'occupied').length }, financials: [...sums.values()], discrepancies, forecast, maintenance, assumptions: ['P&L recognizes lease rent by calendar day; excludes taxes and depreciation.', 'Cash collections and advance invoices are shown separately.', 'Forecast is contracted rent only; renewals and vacancy fills are not assumed.', 'Currencies are never combined. Deposits are liabilities, excluded from rental income.'] };
  }
}
