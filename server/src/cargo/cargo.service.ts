import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CargoDriver, CargoFlight, Parcel, Shipment } from './cargo.entity';
import { OwnedCrudService } from '../common/owned.service';
import type {
  AssignDriverDto,
  AssignFlightDto,
  UpdateParcelStatusDto,
  UpdateShipmentStatusDto,
} from './dto/cargo.dto';

// Valid parcel status transitions: from → allowed next statuses
const PARCEL_TRANSITIONS: Record<string, string[]> = {
  REGISTERED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

// Valid shipment status transitions
const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['LOADING', 'CANCELLED'],
  LOADING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class ParcelsService extends OwnedCrudService<Parcel> {
  constructor(@InjectRepository(Parcel) repo: Repository<Parcel>) {
    super(repo);
  }

  async updateStatus(ownerId: string, id: string, dto: UpdateParcelStatusDto): Promise<Parcel> {
    const parcel = await this.get(ownerId, id);
    const allowed = PARCEL_TRANSITIONS[parcel.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition parcel from '${parcel.status}' to '${dto.status}'. ` +
        `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}`,
      );
    }
    return this.update(ownerId, id, { status: dto.status });
  }
}

@Injectable()
export class ShipmentsService extends OwnedCrudService<Shipment> {
  constructor(
    @InjectRepository(Shipment) repo: Repository<Shipment>,
    @InjectRepository(CargoDriver) private readonly driverRepo: Repository<CargoDriver>,
    @InjectRepository(CargoFlight) private readonly flightRepo: Repository<CargoFlight>,
  ) {
    super(repo);
  }

  async updateStatus(ownerId: string, id: string, dto: UpdateShipmentStatusDto): Promise<Shipment> {
    const shipment = await this.get(ownerId, id);
    const allowed = SHIPMENT_TRANSITIONS[shipment.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition shipment from '${shipment.status}' to '${dto.status}'. ` +
        `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}`,
      );
    }
    return this.update(ownerId, id, { status: dto.status });
  }

  async assignDriver(ownerId: string, shipmentId: string, dto: AssignDriverDto): Promise<Shipment> {
    const shipment = await this.get(ownerId, shipmentId);
    if (!['PENDING', 'LOADING'].includes(shipment.status)) {
      throw new BadRequestException(
        `Cannot assign a driver to a shipment with status '${shipment.status}'.`,
      );
    }
    const driver = await this.driverRepo.findOne({ where: { id: dto.driverId, ownerId } });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.status !== 'AVAILABLE') {
      throw new BadRequestException(
        `Driver is not available (current status: '${driver.status}').`,
      );
    }
    driver.status = 'ON_TRIP';
    await this.driverRepo.save(driver);
    return this.update(ownerId, shipmentId, { driverId: dto.driverId });
  }

  async assignFlight(ownerId: string, shipmentId: string, dto: AssignFlightDto): Promise<Shipment> {
    const shipment = await this.get(ownerId, shipmentId);
    if (!['PENDING', 'LOADING'].includes(shipment.status)) {
      throw new BadRequestException(
        `Cannot assign a flight to a shipment with status '${shipment.status}'.`,
      );
    }
    const flight = await this.flightRepo.findOne({ where: { id: dto.flightId, ownerId } });
    if (!flight) throw new NotFoundException('Flight not found');
    if (!['SCHEDULED', 'BOARDING'].includes(flight.status)) {
      throw new BadRequestException(
        `Flight is not accepting cargo (status: '${flight.status}').`,
      );
    }
    const remaining = flight.capacityKg - flight.bookedKg;
    if (shipment.weight > remaining) {
      throw new BadRequestException(
        `Insufficient flight capacity. Required: ${shipment.weight} kg, available: ${remaining} kg.`,
      );
    }
    flight.bookedKg += shipment.weight;
    await this.flightRepo.save(flight);
    return this.update(ownerId, shipmentId, {
      flightNumber: flight.flightNumber,
      carrier: flight.carrier ?? undefined,
    });
  }
}

@Injectable()
export class DriversService extends OwnedCrudService<CargoDriver> {
  constructor(@InjectRepository(CargoDriver) repo: Repository<CargoDriver>) {
    super(repo);
  }
}

@Injectable()
export class FlightsService extends OwnedCrudService<CargoFlight> {
  constructor(@InjectRepository(CargoFlight) repo: Repository<CargoFlight>) {
    super(repo);
  }
}
