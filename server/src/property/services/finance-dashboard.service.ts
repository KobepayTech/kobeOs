import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { OwnedCrudService } from '../../common/owned.service';
import {
  Property,
  PropertyExpense,
  PropertySetting,
  PropertyUnit,
  PropertyWorkOrder,
  RentCharge,
  RentIncreaseSimulation,
  Tenant,
} from '../property.entity';
import { asDate, money } from './property-utils';

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
    for (const key of Object.keys(this.defaults())) {
      const value = patch[key];
      if (value === undefined) continue;
      let row = await this.repo.findOne({ where: { ownerId, key } });
      if (!row) row = this.repo.create({ ownerId, key, value: String(value) });
      row.value = String(value);
      await this.repo.save(row);
    }
    return this.get(ownerId);
  }

  /** Read the owner's public site config (JSON blob under key 'siteConfig'). */
  async getSite(ownerId: string): Promise<Record<string, unknown>> {
    const row = await this.repo.findOne({ where: { ownerId, key: 'siteConfig' } });
    if (!row?.value) return {};
    try { return JSON.parse(row.value) as Record<string, unknown>; } catch { return {}; }
  }

  /** Persist the owner's public site config. */
  async saveSite(ownerId: string, config: Record<string, unknown>) {
    let row = await this.repo.findOne({ where: { ownerId, key: 'siteConfig' } });
    if (!row) row = this.repo.create({ ownerId, key: 'siteConfig', value: '' });
    row.value = JSON.stringify(config ?? {});
    await this.repo.save(row);
    return this.getSite(ownerId);
  }
}

@Injectable()
export class ExpensesService extends OwnedCrudService<PropertyExpense> {
  constructor(@InjectRepository(PropertyExpense) repo: Repository<PropertyExpense>) { super(repo); }

  override create(ownerId: string, data: DeepPartial<PropertyExpense>) {
    return super.create(ownerId, this.normalize(data));
  }

  override update(ownerId: string, id: string, data: DeepPartial<PropertyExpense>) {
    return super.update(ownerId, id, this.normalize(data));
  }

  private normalize(data: DeepPartial<PropertyExpense>) {
    const raw = data as Record<string, unknown>;
    const out: Record<string, unknown> = { ...raw };
    if (raw.spentAt) out.spentAt = asDate(raw.spentAt);
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
    const where: FindOptionsWhere<PropertyUnit> = { ownerId } as FindOptionsWhere<PropertyUnit>;
    if (input.propertyId) where.propertyId = input.propertyId;
    const units = await this.unitsRepo.find({ where });
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
