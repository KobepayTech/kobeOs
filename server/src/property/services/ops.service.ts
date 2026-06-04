import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { OwnedCrudService } from '../../common/owned.service';
import { PropertyApplication, PropertyVendor, PropertyWorkOrder } from '../property.entity';
import { asDate } from './property-utils';

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

  override create(ownerId: string, data: DeepPartial<PropertyWorkOrder>) {
    return super.create(ownerId, this.normalize(data));
  }

  override update(ownerId: string, id: string, data: DeepPartial<PropertyWorkOrder>) {
    return super.update(ownerId, id, this.normalize(data));
  }

  private normalize(data: DeepPartial<PropertyWorkOrder>) {
    const raw = data as Record<string, unknown>;
    const out: Record<string, unknown> = { ...raw };
    if (raw.scheduledAt) out.scheduledAt = asDate(raw.scheduledAt);
    if (raw.completedAt) out.completedAt = asDate(raw.completedAt);
    return out as DeepPartial<PropertyWorkOrder>;
  }

  filtered(ownerId: string, params: { status?: string; propertyId?: string; vendorId?: string }) {
    const where: FindOptionsWhere<PropertyWorkOrder> = { ownerId } as FindOptionsWhere<PropertyWorkOrder>;
    if (params.status) where.status = params.status as PropertyWorkOrder['status'];
    if (params.propertyId) where.propertyId = params.propertyId;
    if (params.vendorId) where.vendorId = params.vendorId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }
}

@Injectable()
export class ApplicationsService extends OwnedCrudService<PropertyApplication> {
  constructor(@InjectRepository(PropertyApplication) repo: Repository<PropertyApplication>) { super(repo); }

  override create(ownerId: string, data: DeepPartial<PropertyApplication>) {
    return super.create(ownerId, this.normalize(data));
  }

  override update(ownerId: string, id: string, data: DeepPartial<PropertyApplication>) {
    return super.update(ownerId, id, this.normalize(data));
  }

  private normalize(data: DeepPartial<PropertyApplication>) {
    const raw = data as Record<string, unknown>;
    const out: Record<string, unknown> = { ...raw };
    if (raw.desiredMoveIn) out.desiredMoveIn = asDate(raw.desiredMoveIn);
    return out as DeepPartial<PropertyApplication>;
  }

  byStatus(ownerId: string, status?: string) {
    return status ? this.repo.find({ where: { ownerId, status: status as PropertyApplication['status'] }, order: { createdAt: 'DESC' } }) : this.list(ownerId);
  }
}
