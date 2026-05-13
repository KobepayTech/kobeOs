import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign, Coupon, DiscountRule } from './discount.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class RulesService extends OwnedCrudService<DiscountRule> {
  constructor(@InjectRepository(DiscountRule) repo: Repository<DiscountRule>) { super(repo); }
}
@Injectable()
export class CouponsService extends OwnedCrudService<Coupon> {
  constructor(@InjectRepository(Coupon) repo: Repository<Coupon>) { super(repo); }
}
@Injectable()
export class CampaignsService extends OwnedCrudService<Campaign> {
  constructor(@InjectRepository(Campaign) repo: Repository<Campaign>) { super(repo); }
}
