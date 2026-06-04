import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Fr24Service } from './fr24.service';

class AssignFr24FlightDto {
  flightNumber!: string;
}

/**
 * Public-facing FR24 routes. All endpoints are server-side — the API key
 * never leaves the backend. Frontend consumers hit these routes with a normal
 * JWT and get back already-normalised flight objects.
 */
@UseGuards(JwtAuthGuard)
@Controller('cargo/flights/fr24')
export class Fr24Controller {
  constructor(private readonly fr24: Fr24Service) {}

  @Get('status')
  status() {
    return { configured: this.fr24.isConfigured() };
  }

  @Get('airport/:code/departures')
  departures(@Param('code') code: string) {
    return this.fr24.airportDepartures(code);
  }

  @Get('airport/:code/arrivals')
  arrivals(@Param('code') code: string) {
    return this.fr24.airportArrivals(code);
  }

  @Get(':flightNumber')
  byNumber(@Param('flightNumber') flightNumber: string) {
    return this.fr24.flightByNumber(flightNumber);
  }
}

/**
 * Assign-flight lives under /cargo/shipments to mirror the shipment-scoped
 * route style used elsewhere in the cargo controller. Kept in this file so
 * FR24-related routes co-locate.
 */
@UseGuards(JwtAuthGuard)
@Controller('cargo/shipments')
export class Fr24ShipmentController {
  constructor(private readonly fr24: Fr24Service) {}

  @Post(':id/assign-fr24-flight')
  assign(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: AssignFr24FlightDto) {
    if (!dto?.flightNumber?.trim()) {
      throw new BadRequestException('flightNumber is required');
    }
    return this.fr24.assignFlightToShipment(uid, id, dto.flightNumber.trim());
  }
}
