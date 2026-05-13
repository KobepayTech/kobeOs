import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelBooking, HotelGuest, HotelRoom } from './hotel.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class RoomsService extends OwnedCrudService<HotelRoom> {
  constructor(@InjectRepository(HotelRoom) repo: Repository<HotelRoom>) { super(repo); }
}
@Injectable()
export class GuestsService extends OwnedCrudService<HotelGuest> {
  constructor(@InjectRepository(HotelGuest) repo: Repository<HotelGuest>) { super(repo); }
}
@Injectable()
export class BookingsService extends OwnedCrudService<HotelBooking> {
  constructor(@InjectRepository(HotelBooking) repo: Repository<HotelBooking>) { super(repo); }
}
