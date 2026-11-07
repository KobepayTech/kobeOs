import { PropertyOperation } from './property-intelligence.entity';
import { InboundPayment } from '../mobile-money/mobile-money.entity';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Property, PropertyUnit, RentCharge, RentPayment, Tenant } from './property.entity';
import { OwnedCrudService } from '../common/owned.service';
import { CommerceService } from '../commerce/commerce.service';

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
  constructor(
    @InjectRepository(Property) repo: Repository<Property>,
    private readonly commerce: CommerceService,
  ) { super(repo); }

  override async create(ownerId: string, data: DeepPartial<Property>) {
    const property = await super.create(ownerId, data);
    await this.commerce.provisionPropertyMarketplace(ownerId, property.id);
    return this.get(ownerId, property.id);
  }

  override async update(ownerId: string, id: string, data: DeepPartial<Property>) {
    await super.update(ownerId, id, data);
    await this.commerce.provisionPropertyMarketplace(ownerId, id);
    return this.get(ownerId, id);
  }
}

@Injectable()
export class UnitsService extends OwnedCrudService<PropertyUnit> {
  constructor(
    @InjectRepository(PropertyUnit) repo: Repository<PropertyUnit>,
    private readonly commerce: CommerceService,
  ) { super(repo); }

  byProperty(uid: string, propertyId: string) {
    return this.repo.find({ where: { ownerId: uid, propertyId }, order: { unitNumber: 'ASC' } });
  }

  override async create(ownerId: string, data: DeepPartial<PropertyUnit>) {
    const unit = await super.create(ownerId, data);
    await this.commerce.provisionPropertyMarketplace(ownerId, unit.propertyId);
    return unit;
  }

  override async update(ownerId: string, id: string, data: DeepPartial<PropertyUnit>) {
    const before = await this.get(ownerId, id);
    const unit = await super.update(ownerId, id, data);
    await this.commerce.provisionPropertyMarketplace(ownerId, before.propertyId);
    if (unit.propertyId !== before.propertyId) await this.commerce.provisionPropertyMarketplace(ownerId, unit.propertyId);
    return unit;
  }

  override async remove(ownerId: string, id: string) {
    const unit = await this.get(ownerId, id);
    const result = await super.remove(ownerId, id);
    await this.commerce.provisionPropertyMarketplace(ownerId, unit.propertyId);
    return result;
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
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Payment must be positive.');
    return this.repo.manager.transaction(async (tx) => {
      const charges = tx.getRepository(RentCharge);
      const payments = tx.getRepository(RentPayment);
      const unit = await tx.getRepository(PropertyUnit).findOne({ where: { id: data.unitId, ownerId } });
      if (!unit || (data.currency && data.currency !== unit.currency)) throw new BadRequestException('Invalid unit or payment currency.');
      const periodDate = new Date(data.forMonth as Date);
      if (!Number.isFinite(periodDate.getTime())) throw new BadRequestException('Invalid rent period.');
      const where = { ownerId, tenantId: data.tenantId, unitId: data.unitId, ...(data.chargeId ? { id: data.chargeId } : { period: periodDate.toISOString().slice(0, 7) }) };
      const matches = await charges.find({ where, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
      if (matches.length !== 1) throw new BadRequestException('Select one rent charge. Generate the lease charge first.');
      const charge = matches[0];
      if (data.idempotencyKey) {
        const existing = await payments.findOne({ where: { ownerId, idempotencyKey: data.idempotencyKey } });
        if (existing) {
          if (existing.chargeId !== charge.id || Number(existing.amount) !== amount) throw new BadRequestException('Payment key was already used for another payment.');
          return existing;
        }
      }
      if (charge.status === 'waived') throw new BadRequestException('Cannot pay a waived charge.');
      if (amount > numeric(charge.amount) - numeric(charge.amountPaid)) throw new BadRequestException('Payment exceeds this charge’s outstanding balance.');
      const payment = await payments.save(payments.create({ ...data, ownerId, chargeId: charge.id, currency: unit.currency, forMonth: new Date(`${charge.period}-01T00:00:00Z`) }));
      charge.amountPaid = Math.round((numeric(charge.amountPaid) + amount) * 10000) / 10000;
      charge.status = resolveChargeStatus(charge);
      await charges.save(charge);
      return payment;
    });
  }

  override async update(_ownerId: string, _id: string, _data: DeepPartial<RentPayment>): Promise<RentPayment> {
    throw new BadRequestException('Reverse the payment and record a correction instead.');
  }

  override async remove(ownerId: string, id: string) {
    return this.repo.manager.transaction(async (tx) => {
      const payments = tx.getRepository(RentPayment);
      const existing = await payments.findOne({ where: { ownerId, id }, lock: { mode: 'pessimistic_write' } });
      if (!existing) throw new NotFoundException('Payment not found.');
      if (await tx.getRepository(PropertyOperation).findOneBy({ ownerId, key: `journal:payment:${id}` }) || await tx.getRepository(InboundPayment).findOneBy({ ownerId, consumedBy: 'PROPERTY_RENT', consumedRef: id })) throw new BadRequestException('Verified or posted payments require an audited accounting reversal; deletion is disabled.');
      if (existing.chargeId) {
        const charges = tx.getRepository(RentCharge);
        const charge = await charges.findOne({ where: { ownerId, id: existing.chargeId }, lock: { mode: 'pessimistic_write' } });
        if (!charge) throw new BadRequestException('Linked rent charge is missing.');
        charge.amountPaid = Math.max(0, numeric(charge.amountPaid) - numeric(existing.amount));
        charge.status = resolveChargeStatus(charge);
        await charges.save(charge);
      }
      await payments.remove(existing);
      return { id };
    });
  }

}

import { PropertyDocument } from './property-document.entity';
@Injectable()
export class PropertyDocumentsService extends OwnedCrudService<PropertyDocument> {
  constructor(@InjectRepository(PropertyDocument) repo: Repository<PropertyDocument>) { super(repo); }
}
