import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnedCrudService } from '../common/owned.service';
import { HotelInventoryItem, HotelStaff, HotelChannel } from './hotel-extras.entity';

@Injectable()
export class HotelInventoryService extends OwnedCrudService<HotelInventoryItem> {
  constructor(@InjectRepository(HotelInventoryItem) repo: Repository<HotelInventoryItem>) { super(repo); }
}

@Injectable()
export class HotelStaffService extends OwnedCrudService<HotelStaff> {
  constructor(@InjectRepository(HotelStaff) repo: Repository<HotelStaff>) { super(repo); }
}

@Injectable()
export class HotelChannelsService extends OwnedCrudService<HotelChannel> {
  constructor(@InjectRepository(HotelChannel) repo: Repository<HotelChannel>) { super(repo); }
}
