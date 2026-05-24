import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdminCompany, AdminInvoice, AdminRole, AdminSubscription, AdminTicket,
} from './admin.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class CompaniesService extends OwnedCrudService<AdminCompany> {
  constructor(@InjectRepository(AdminCompany) repo: Repository<AdminCompany>) { super(repo); }
}

@Injectable()
export class SubscriptionsService extends OwnedCrudService<AdminSubscription> {
  constructor(@InjectRepository(AdminSubscription) repo: Repository<AdminSubscription>) { super(repo); }
}

@Injectable()
export class InvoicesService extends OwnedCrudService<AdminInvoice> {
  constructor(@InjectRepository(AdminInvoice) repo: Repository<AdminInvoice>) { super(repo); }
}

@Injectable()
export class RolesService extends OwnedCrudService<AdminRole> {
  constructor(@InjectRepository(AdminRole) repo: Repository<AdminRole>) { super(repo); }
}

@Injectable()
export class TicketsService extends OwnedCrudService<AdminTicket> {
  constructor(@InjectRepository(AdminTicket) repo: Repository<AdminTicket>) { super(repo); }
}
