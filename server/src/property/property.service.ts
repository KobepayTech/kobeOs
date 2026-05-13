import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, PropertyUnit, RentPayment, Tenant } from './property.entity';
import { OwnedCrudService } from '../common/owned.service';

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
  constructor(@InjectRepository(RentPayment) repo: Repository<RentPayment>) { super(repo); }
  byTenant(uid: string, tenantId: string) {
    return this.repo.find({ where: { ownerId: uid, tenantId }, order: { paidAt: 'DESC' } });
  }
}
