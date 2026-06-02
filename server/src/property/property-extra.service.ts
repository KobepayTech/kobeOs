import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { OwnedCrudService } from '../common/owned.service';
import {
  Property,
  PropertyApplication,
  PropertyExpense,
  PropertyLease,
  PropertySetting,
  PropertyUnit,
  PropertyVendor,
  PropertyWorkOrder,
  RentCharge,
  RentIncreaseSimulation,
  Tenant,
} from './property.entity';

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return new Date(String(value));
}

function chargeStatus(charge: Pick<RentCharge, 'amount' | 'amountPaid' | 'dueDate' | 'status'>): RentCharge['status'] {
  if (charge.status === 'waived') return 'waived';
  const amount = money(charge.amount);
  const paid = money(charge.amountPaid);
  if (paid >= amount && amount > 0) return 'paid';
  if (paid > 0) return 'partial';
  if (new Date(charge.dueDate).getTime() < Date.now()) return 'overdue';
  return 'open';
}

function dueDateFor(period: string, dueDay: number): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, Math.max(0, (month || 1) - 1), Math.max(1, dueDay || 1)));
}

@Injectable()
export class LeasesService extends OwnedCrudService<PropertyLease> {
  constructor(@InjectRepository(PropertyLease) repo: Repository<PropertyLease>) { super(repo); }
  byTenant(ownerId: string, tenantId: string) {
    return this.repo.find({ where: { ownerId, tenantId }, order: { startDate: 'DESC' } });
  }
  byUnit(ownerId: string, unitId: string) {
    return this.repo.find({ where: { ownerId, unitId }, order: { startDate: 'DESC' } });
  }
  override create(ownerId: string, data: DeepPartial<PropertyLease> & Record<string, unknown>) {
    return super.create(ownerId, this.normalize(data));
  }
  override update(ownerId: string, id: string, data: DeepPartial<PropertyLease> & Record<string, unknown>) {
    return super.update(ownerId, id, this.normalize(data));
  }
  private normalize(data: DeepPartial<PropertyLease> & Record<string, unknown>) {
    const out: Record<string, unknown> = { ...data };
    if (data.startDate) out.startDate = asDate(data.startDate);
    if (data.endDate) out.endDate = asDate(data.endDate);
    return out as DeepPartial<PropertyLease>;
  }
}

@Injectable()
export class RentChargesService extends OwnedCrudService<RentCharge> {
  constructor(
    @InjectRepository(RentCharge) repo: Repository<RentCharge>,
    @InjectRepository(PropertyLease) private readonly leasesRepo: Repository<PropertyLease>,
  ) { super(repo); }

  listByPeriod(ownerId: string, period?: string) {
    return period ? this.repo.find({ where: { ownerId, period }, order: { dueDate: 'ASC' } }) : this.list(ownerId);
  }

  override create(ownerId: string, data: DeepPartial<RentCharge> & Record<string, unknown>) {
    return super.create(ownerId, this.normalize(data));
  }
  override update(ownerId: string, id: string, data: DeepPartial<RentCharge> & Record<string, unknown>) {
    return super.update(ownerId, id, this.normalize(data));
  }
  private normalize(data: DeepPartial<RentCharge> & Record<string, unknown>) {
    const out: Record<string, unknown> = { ...data };
    if (data.dueDate) out.dueDate = asDate(data.dueDate);
    return out as DeepPartial<RentCharge>;
  }

  async generate(ownerId: string, period: string) {
    const leases = await this.leasesRepo.find({ where: { ownerId, status: 'active' } });
    let created = 0;
    const charges: RentCharge[] = [];

    for (const lease of leases) {
      const existing = await this.repo.findOne({ where: { ownerId, leaseId: lease.id, period } });
      if (existing) {
        charges.push(existing);
        continue;
      }
      const charge = this.repo.create({
        ownerId,
        leaseId: lease.id,
        tenantId: lease.tenantId,
        unitId: lease.unitId,
        period,
        dueDate: dueDateFor(period, lease.rentDueDay),
        amount: lease.monthlyRent,
        amountPaid: 0,
        status: 'open',
        notes: '',
      });
      charge.status = chargeStatus(charge);
      charges.push(await this.repo.save(charge));
      created += 1;
    }

    return { period, created, charges };
  }

  async applyPayment(ownerId: string, chargeId: string, amount: number) {
    const charge = await this.get(ownerId, chargeId);
    charge.amountPaid = money(charge.amountPaid) + money(amount);
    charge.status = chargeStatus(charge);
    return this.repo.save(charge);
  }

  async removePayment(ownerId: string, chargeId: string, amount: number) {
    const charge = await this.get(ownerId, chargeId);
    charge.amountPaid = Math.max(0, money(charge.amountPaid) - money(amount));
    charge.status = chargeStatus(charge);
    return this.repo.save(charge);
  }

  async waive(ownerId: string, id: string) {
    const charge = await this.get(ownerId, id);
    charge.status = 'waived';
    return this.repo.save(charge);
  }
}

@Injectable()
export class VendorsService extends OwnedCrudService<PropertyVendor> {
  constructor(@InjectRepository(PropertyVendor) repo: Repository<PropertyVendor>) { super(repo); }
  byCategory(ownerId: string, category: string) {
    return this.repo.find({ where: { ownerId, category: category as PropertyVendor['category'] }, order: { name: 'ASC' } });
  }
}

@Injectable()
export class WorkOrdersService extends OwnedCrudService<PropertyWorkOrder> {
  constructor(@InjectRepository(PropertyWorkOrder) repo: Repository<PropertyWorkOrder>) { super(repo); }
  override create(ownerId: string, data: DeepPartial<PropertyWorkOrder> & Record<string, unknown>) {
    return super.create(ownerId, this.normalize(data));
  }
  override update(ownerId: string, id: string, data: DeepPartial<PropertyWorkOrder> & Record<string, unknown>) {
    return super.update(ownerId, id, this.normalize(data));
  }
  private normalize(data: DeepPartial<PropertyWorkOrder> & Record<string, unknown>) {
    const out: Record<string, unknown> = { ...data };
    if (data.scheduledAt) out.scheduledAt = asDate(data.scheduledAt);
    if (data.completedAt) out.completedAt = asDate(data.completedAt);
    return out as DeepPartial<PropertyWorkOrder>;
  }
  filtered(ownerId: string, params: { status?: string; propertyId?: string; vendorId?: string }) {
    const where: Record<string, unknown> = { ownerId };
    if (params.status) where.status = params.status;
    if (params.propertyId) where.propertyId = params.propertyId;
    if (params.vendorId) where.vendorId = params.vendorId;
    return this.repo.find({ where: where as any, order: { createdAt: 'DESC' } });
  }
}

@Injectable()
export class ApplicationsService extends OwnedCrudService<PropertyApplication> {
  constructor(@InjectRepository(PropertyApplication) repo: Repository<PropertyApplication>) { super(repo); }
  override create(ownerId: string, data: DeepPartial<PropertyApplication> & Record<string, unknown>) {
    return super.create(ownerId, this.normalize(data));
  }
  override update(ownerId: string, id: string, data: DeepPartial<PropertyApplication> & Record<string, unknown>) {
    return super.update(ownerId, id, this.normalize(data));
  }
  private normalize(data: DeepPartial<PropertyApplication> & Record<string, unknown>) {
    const out: Record<string, unknown> = { ...data };
    if (data.desiredMoveIn) out.desiredMoveIn = asDate(data.desiredMoveIn);
    return out as DeepPartial<PropertyApplication>;
  }
  byStatus(ownerId: string, status?: string) {
    return status ? this.repo.find({ where: { ownerId, status: status as PropertyApplication['status'] }, order: { createdAt: 'DESC' } }) : this.list(ownerId);
  }
}

@Injectable()
export class PropertySettingsService {
  constructor(@InjectRepository(PropertySetting) private readonly repo: Repository<PropertySetting>) {}

  private defaults(): Record<string, string> {
    return {
      defaultRentDueDay: '1',
      lateFeeAmount: '0',
      lateFeeGraceDays: '5',
      currency: 'TZS',
      reminderChannels: 'WhatsApp,SMS',
      invoicePrefix: 'KBE-RNT',
    };
  }

  async get(ownerId: string) {
    const rows = await this.repo.find({ where: { ownerId } });
    return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), this.defaults());
  }

  async update(ownerId: string, patch: Record<string, unknown>) {
    const allowed = Object.keys(this.defaults());
    for (const key of allowed) {
      const value = patch[key];
      if (value === undefined) continue;
      let row = await this.repo.findOne({ where: { ownerId, key } });
      if (!row) row = this.repo.create({ ownerId, key, value: String(value) });
      row.value = String(value);
      await this.repo.save(row);
    }
    return this.get(ownerId);
  }
}

@Injectable()
export class ExpensesService extends OwnedCrudService<PropertyExpense> {
  constructor(@InjectRepository(PropertyExpense) repo: Repository<PropertyExpense>) { super(repo); }
  override create(ownerId: string, data: DeepPartial<PropertyExpense> & Record<string, unknown>) {
    return super.create(ownerId, this.normalize(data));
  }
  override update(ownerId: string, id: string, data: DeepPartial<PropertyExpense> & Record<string, unknown>) {
    return super.update(ownerId, id, this.normalize(data));
  }
  private normalize(data: DeepPartial<PropertyExpense> & Record<string, unknown>) {
    const out: Record<string, unknown> = { ...data };
    if (data.spentAt) out.spentAt = asDate(data.spentAt);
    return out as DeepPartial<PropertyExpense>;
  }
  byProperty(ownerId: string, propertyId: string) {
    return this.repo.find({ where: { ownerId, propertyId }, order: { spentAt: 'DESC' } });
  }
}

@Injectable()
export class RentIncreaseSimulationsService extends OwnedCrudService<RentIncreaseSimulation> {
  constructor(
    @InjectRepository(RentIncreaseSimulation) repo: Repository<RentIncreaseSimulation>,
    @InjectRepository(PropertyUnit) private readonly unitsRepo: Repository<PropertyUnit>,
  ) { super(repo); }

  async simulate(ownerId: string, input: { propertyId?: string; increasePercent: number; notes?: string }) {
    const where: Record<string, unknown> = { ownerId };
    if (input.propertyId) where.propertyId = input.propertyId;
    const units = await this.unitsRepo.find({ where: where as any });
    const current = units.reduce((sum, unit) => sum + money(unit.rentAmount), 0);
    const projected = current * (1 + money(input.increasePercent) / 100);
    const row = this.repo.create({
      ownerId,
      propertyId: input.propertyId ?? null,
      increasePercent: input.increasePercent,
      currentMonthlyRent: current,
      projectedMonthlyRent: projected,
      monthlyDifference: projected - current,
      annualDifference: (projected - current) * 12,
      notes: input.notes ?? '',
    });
    return this.repo.save(row);
  }
}

@Injectable()
export class PropertyDashboardService {
  constructor(
    @InjectRepository(Property) private readonly propertiesRepo: Repository<Property>,
    @InjectRepository(PropertyUnit) private readonly unitsRepo: Repository<PropertyUnit>,
    @InjectRepository(Tenant) private readonly tenantsRepo: Repository<Tenant>,
    @InjectRepository(RentCharge) private readonly chargesRepo: Repository<RentCharge>,
    @InjectRepository(PropertyWorkOrder) private readonly workOrdersRepo: Repository<PropertyWorkOrder>,
    @InjectRepository(PropertyExpense) private readonly expensesRepo: Repository<PropertyExpense>,
  ) {}

  async summary(ownerId: string, period?: string) {
    const [properties, units, tenants, charges, workOrders, expenses] = await Promise.all([
      this.propertiesRepo.find({ where: { ownerId } }),
      this.unitsRepo.find({ where: { ownerId } }),
      this.tenantsRepo.find({ where: { ownerId } }),
      this.chargesRepo.find({ where: period ? { ownerId, period } : { ownerId } }),
      this.workOrdersRepo.find({ where: { ownerId } }),
      this.expensesRepo.find({ where: { ownerId } }),
    ]);
    const occupied = units.filter((u) => u.status === 'occupied').length;
    const charged = charges.reduce((sum, c) => sum + money(c.amount), 0);
    const collected = charges.reduce((sum, c) => sum + money(c.amountPaid), 0);
    const expenseTotal = expenses.reduce((sum, e) => sum + money(e.amount), 0);
    return {
      properties: properties.length,
      units: units.length,
      occupied,
      vacant: units.filter((u) => u.status === 'vacant').length,
      occupancyRate: units.length ? Math.round((occupied / units.length) * 100) : 0,
      tenants: tenants.length,
      charged,
      collected,
      outstanding: Math.max(0, charged - collected),
      overdueCount: charges.filter((c) => c.status === 'overdue').length,
      openWorkOrders: workOrders.filter((w) => !['completed', 'cancelled'].includes(w.status)).length,
      urgentWorkOrders: workOrders.filter((w) => w.priority === 'urgent' && w.status !== 'completed').length,
      expenses: expenseTotal,
      net: collected - expenseTotal,
    };
  }
}
