import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DriversService, FlightsService, ParcelsService, ShipmentsService } from './cargo.service';
import {
  AssignDriverDto, AssignFlightDto,
  CreateDriverDto, CreateFlightDto, CreateParcelDto, CreateShipmentDto,
  UpdateDriverDto, UpdateFlightDto, UpdateParcelDto, UpdateParcelStatusDto,
  UpdateShipmentDto, UpdateShipmentStatusDto,
} from './dto/cargo.dto';

@UseGuards(JwtAuthGuard)
@Controller('cargo')
export class CargoController {
  constructor(
    private readonly parcels: ParcelsService,
    private readonly shipments: ShipmentsService,
    private readonly drivers: DriversService,
    private readonly flights: FlightsService,
  ) {}

  // Parcels
  @Get('parcels') listParcels(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.parcels.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }
  @Post('parcels') createParcel(@CurrentUser('id') uid: string, @Body() dto: CreateParcelDto) { return this.parcels.create(uid, dto); }
  @Patch('parcels/:id') updateParcel(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateParcelDto) { return this.parcels.update(uid, id, dto); }
  @Patch('parcels/:id/status') updateParcelStatus(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateParcelStatusDto) { return this.parcels.updateStatus(uid, id, dto); }
  @Delete('parcels/:id') removeParcel(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.parcels.remove(uid, id); }

  // Shipments
  @Get('shipments') listShipments(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.shipments.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }
  @Post('shipments') createShipment(@CurrentUser('id') uid: string, @Body() dto: CreateShipmentDto) { return this.shipments.create(uid, dto); }
  @Patch('shipments/:id') updateShipment(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateShipmentDto) { return this.shipments.update(uid, id, dto); }
  @Patch('shipments/:id/status') updateShipmentStatus(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateShipmentStatusDto) { return this.shipments.updateStatus(uid, id, dto); }
  @Post('shipments/:id/assign-driver') assignDriver(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: AssignDriverDto) { return this.shipments.assignDriver(uid, id, dto); }
  @Post('shipments/:id/assign-flight') assignFlight(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: AssignFlightDto) { return this.shipments.assignFlight(uid, id, dto); }
  @Delete('shipments/:id') removeShipment(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.shipments.remove(uid, id); }

  // Drivers
  @Get('drivers') listDrivers(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.drivers.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }
  @Post('drivers') createDriver(@CurrentUser('id') uid: string, @Body() dto: CreateDriverDto) { return this.drivers.create(uid, dto); }
  @Patch('drivers/:id') updateDriver(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateDriverDto) { return this.drivers.update(uid, id, dto); }
  @Delete('drivers/:id') removeDriver(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.drivers.remove(uid, id); }

  // Flights
  @Get('flights') listFlights(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.flights.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }
  @Post('flights') createFlight(@CurrentUser('id') uid: string, @Body() dto: CreateFlightDto) { return this.flights.create(uid, dto); }
  @Patch('flights/:id') updateFlight(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateFlightDto) { return this.flights.update(uid, id, dto); }
  @Delete('flights/:id') removeFlight(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.flights.remove(uid, id); }
}
