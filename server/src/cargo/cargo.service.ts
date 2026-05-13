import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CargoDriver, CargoFlight, Parcel, Shipment } from './cargo.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class ParcelsService extends OwnedCrudService<Parcel> {
  constructor(@InjectRepository(Parcel) repo: Repository<Parcel>) { super(repo); }
}
@Injectable()
export class ShipmentsService extends OwnedCrudService<Shipment> {
  constructor(@InjectRepository(Shipment) repo: Repository<Shipment>) { super(repo); }
}
@Injectable()
export class DriversService extends OwnedCrudService<CargoDriver> {
  constructor(@InjectRepository(CargoDriver) repo: Repository<CargoDriver>) { super(repo); }
}
@Injectable()
export class FlightsService extends OwnedCrudService<CargoFlight> {
  constructor(@InjectRepository(CargoFlight) repo: Repository<CargoFlight>) { super(repo); }
}
