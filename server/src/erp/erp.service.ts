import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ErpAccount, ErpTransaction, LoyaltyCustomer, LoyaltyPointsEntry, LoyaltyReward,
  PurchaseOrder, Supplier,
} from './erp.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class AccountsService extends OwnedCrudService<ErpAccount> {
  constructor(@InjectRepository(ErpAccount) repo: Repository<ErpAccount>) { super(repo); }
}
@Injectable()
export class TransactionsService extends OwnedCrudService<ErpTransaction> {
  constructor(@InjectRepository(ErpTransaction) repo: Repository<ErpTransaction>) { super(repo); }
}
@Injectable()
export class LoyaltyCustomersService extends OwnedCrudService<LoyaltyCustomer> {
  constructor(@InjectRepository(LoyaltyCustomer) repo: Repository<LoyaltyCustomer>) { super(repo); }
}
@Injectable()
export class RewardsService extends OwnedCrudService<LoyaltyReward> {
  constructor(@InjectRepository(LoyaltyReward) repo: Repository<LoyaltyReward>) { super(repo); }
}
@Injectable()
export class PointsService extends OwnedCrudService<LoyaltyPointsEntry> {
  constructor(@InjectRepository(LoyaltyPointsEntry) repo: Repository<LoyaltyPointsEntry>) { super(repo); }
}
@Injectable()
export class SuppliersService extends OwnedCrudService<Supplier> {
  constructor(@InjectRepository(Supplier) repo: Repository<Supplier>) { super(repo); }
}
@Injectable()
export class PurchaseOrdersService extends OwnedCrudService<PurchaseOrder> {
  constructor(@InjectRepository(PurchaseOrder) repo: Repository<PurchaseOrder>) { super(repo); }
}
