import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Property, PropertyUnit, RentCharge, RentPayment, Tenant } from './property.entity';
import { OwnedCrudService } from '../common/owned.service';

function numeric(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function resolveChargeStatus(charge: RentCharge): RentCharge['status'] {
  if (charge.status === 'waived') return 'waived';
  const amount = numeric(charge.amount);
  const paid = numeric(charge.amountPaid);
  if (amount > 0 && paid >= amount) return 'paid';
  if (paid > 0) return 'partial';
  if (new Date(charge.dueDate).getTime() < Date.now()) return 'overdue';
  return 'open';
}

@Injectable()
export class PropertiesService extends OwnedCrudService<Property> {
  constructor(@InjectRepository(Property) repo: Repository<Property>) { super(repo); }
}

@Injectable()
export class UnitsService extends OwnedCrudService<PropertyUnit> {
  constructor(@InjectRepository(PropertyUnit) repo: Repository<PropertyUnit>) { super(repo); }
  byProperty(uid: string, propertyId: string) {
    return this.repo.find({ where: { ownerId: uid, propertyId }, order: { unitNumber: 'ASC' } });
  }
}

@Injectable()
export class TenantsService extends OwnedCrudService<Tenant> {
  constructor(@InjectRepository(Tenant) repo: Repository<Tenant>) { super(repo); }
}

@Injectable()
export class RentPaymentsService extends OwnedCrudService<RentPayment> {
  constructor(
    @InjectRepository(RentPayment) repo: Repository<RentPayment>,
    @InjectRepository(RentCharge) private readonly chargesRepo: Repository<RentCharge>,
  ) { super(repo); }

  byTenant(uid: string, tenantId: string) {
    return this.repo.find({ where: { ownerId: uid, tenantId }, order: { paidAt: 'DESC' } });
  }

  override async create(ownerId: string, data: DeepPartial<RentPayment>) {
    const payment = await super.create(ownerId, data);
    if (payment.chargeId) await this.adjustCharge(ownerId, payment.chargeId, numeric(payment.amount));
    return payment;
  }

  override async remove(ownerId: string, id: string) {
    const existing = await this.get(ownerId, id);
    const result = await super.remove(ownerId, id);
    if (existing.chargeId) await this.adjustCharge(ownerId, existing.chargeId, -numeric(existing.amount));
    return result;
  }

  private async adjustCharge(ownerId: string, chargeId: string, delta: number) {
    const charge = await this.chargesRepo.findOne({ where: { ownerId, id: chargeId } });
    if (!charge) return;
    charge.amountPaid = Math.max(0, numeric(charge.amountPaid) + delta);
    charge.status = resolveChargeStatus(charge);
    await this.chargesRepo.save(charge);
  }
}
