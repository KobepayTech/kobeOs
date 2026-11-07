import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { OwnedCrudService } from '../../common/owned.service';
import { PropertyLease, PropertyUnit, Tenant, RentCharge } from '../property.entity';
import { scheduledCharge } from './rent-schedule';
import { asDate, chargeStatus, money } from './property-utils';

@Injectable()
export class LeasesService extends OwnedCrudService<PropertyLease> {
  constructor(@InjectRepository(PropertyLease) repo: Repository<PropertyLease>) { super(repo); }

  byTenant(ownerId: string, tenantId: string) {
    return this.repo.find({ where: { ownerId, tenantId }, order: { startDate: 'DESC' } });
  }

  byUnit(ownerId: string, unitId: string) {
    return this.repo.find({ where: { ownerId, unitId }, order: { startDate: 'DESC' } });
  }

  override async create(ownerId: string, data: DeepPartial<PropertyLease>) {
    await this.validateLease(ownerId, data);
    return super.create(ownerId, this.normalize(data));
  }

  override async update(ownerId: string, id: string, data: DeepPartial<PropertyLease>) {
    const existing = await this.get(ownerId, id);
    await this.validateLease(ownerId, { ...existing, ...data });
    if (['billingMonths', 'monthlyRent', 'startDate', 'endDate', 'unitId', 'tenantId'].some((key) => key in data)) {
      const count = await this.repo.manager.getRepository(RentCharge).count({ where: { ownerId, leaseId: id } });
      if (count) throw new BadRequestException('This lease already has charges. Create a renewal for changed terms.');
    }
    return super.update(ownerId, id, this.normalize(data));
  }

  private async validateLease(ownerId: string, data: DeepPartial<PropertyLease>) {
    const unit = await this.repo.manager.getRepository(PropertyUnit).findOne({ where: { id: data.unitId, ownerId } });
    const tenant = await this.repo.manager.getRepository(Tenant).findOne({ where: { id: data.tenantId, ownerId } });
    if (!unit || !tenant || (tenant.unitId && tenant.unitId !== unit.id)) throw new BadRequestException('Tenant and unit must belong to this owner and match.');
    const startDate = new Date(data.startDate as Date);
    if (!Number.isFinite(startDate.getTime())) throw new BadRequestException('Invalid start date.');
    scheduledCharge({ ...data, startDate, endDate: data.endDate as Date, monthlyRent: data.monthlyRent!, rentDueDay: data.rentDueDay ?? 1 }, startDate.toISOString().slice(0, 7));
  }

  private normalize(data: DeepPartial<PropertyLease>) {
    const raw = data as Record<string, unknown>;
    const out: Record<string, unknown> = { ...raw };
    if (raw.startDate) out.startDate = asDate(raw.startDate);
    if (raw.endDate) out.endDate = asDate(raw.endDate);
    return out as DeepPartial<PropertyLease>;
  }
}

@Injectable()
export class RentChargesService extends OwnedCrudService<RentCharge> {
  constructor(
    @InjectRepository(RentCharge) repo: Repository<RentCharge>,
    @InjectRepository(PropertyLease) private readonly leasesRepo: Repository<PropertyLease>,
  ) { super(repo); }

  async listByPeriod(ownerId: string, period?: string) {
    const rows = period
      ? await this.repo.find({ where: { ownerId, period }, order: { dueDate: 'ASC' } })
      : await this.repo.find({ where: { ownerId }, order: { dueDate: 'DESC' } });
    return this.refreshStatuses(rows);
  }

  async byTenant(ownerId: string, tenantId: string) {
    const rows = await this.repo.find({ where: { ownerId, tenantId }, order: { dueDate: 'DESC' } });
    return this.refreshStatuses(rows);
  }

  private async refreshStatuses(rows: RentCharge[]) {
    // Derive overdue status on read without writing stale balance snapshots.
    for (const row of rows) row.status = chargeStatus(row);
    return rows;
  }

  override create(ownerId: string, data: DeepPartial<RentCharge>) {
    return super.create(ownerId, this.normalize(data));
  }

  override update(ownerId: string, id: string, data: DeepPartial<RentCharge>) {
    return super.update(ownerId, id, this.normalize(data));
  }

  private normalize(data: DeepPartial<RentCharge>) {
    const raw = data as Record<string, unknown>;
    const out: Record<string, unknown> = { ...raw };
    if (raw.dueDate) out.dueDate = asDate(raw.dueDate);
    return out as DeepPartial<RentCharge>;
  }

  async generate(ownerId: string, period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('Period must be YYYY-MM.');
    return this.repo.manager.transaction(async (tx) => {
      // Serialize generators for each lease; retries return existing charges.
      const leases = await tx.getRepository(PropertyLease).find({ where: { ownerId, status: 'active' }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
      const repo = tx.getRepository(RentCharge);
      let created = 0;
      const charges: RentCharge[] = [];
      for (const lease of leases) {
        const schedule = scheduledCharge(lease, period);
        if (!schedule) continue;
        const existing = await repo.findOne({ where: { ownerId, leaseId: lease.id, period } });
        if (existing) { charges.push(existing); continue; }
        const charge = repo.create({ ownerId, leaseId: lease.id, tenantId: lease.tenantId, unitId: lease.unitId, period, dueDate: schedule.dueDate, amount: schedule.amount, amountPaid: 0, status: 'open', notes: `${schedule.months} month(s) in advance` });
        charge.status = chargeStatus(charge);
        charges.push(await repo.save(charge));
        created++;
      }
      return { period, created, charges };
    });
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
