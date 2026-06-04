import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Fr24Service } from './fr24.service';

const TZ_AIRPORTS = ['DAR', 'ZNZ', 'JRO', 'MWZ'];

type BoardDirection = 'departures' | 'arrivals';

@UseGuards(JwtAuthGuard)
@Controller('cargo/fr24')
export class Fr24Controller {
  constructor(private readonly fr24: Fr24Service) {}

  @Get('status')
  status() {
    return { configured: this.fr24.configured(), tanzaniaAirports: TZ_AIRPORTS };
  }

  @Get('airport/:code/departures')
  departures(@Param('code') code: string, @Query() query: Record<string, string>) {
    return this.fr24.airportBoard(code, 'departures', query);
  }

  @Get('airport/:code/arrivals')
  arrivals(@Param('code') code: string, @Query() query: Record<string, string>) {
    return this.fr24.airportBoard(code, 'arrivals', query);
  }

  @Get('tanzania/leaving')
  leavingTanzania(@Query() query: Record<string, string>) {
    return this.tanzaniaBoard('departures', query);
  }

  @Get('tanzania/going-to')
  goingToTanzania(@Query() query: Record<string, string>) {
    return this.tanzaniaBoard('arrivals', query);
  }

  @Get('flight/:flightNumber')
  flight(@Param('flightNumber') flightNumber: string) {
    return this.fr24.byFlightNumber(flightNumber);
  }

  @Get('live')
  live(@Query() query: Record<string, string>) {
    return this.fr24.livePositions(query);
  }

  private async tanzaniaBoard(type: BoardDirection, query: Record<string, string>) {
    const results = await Promise.allSettled(
      TZ_AIRPORTS.map(async (airport) => ({
        airport,
        type,
        flights: await this.fr24.airportBoard(airport, type, query),
      })),
    );
    return {
      direction: type === 'departures' ? 'LEAVING_TANZANIA' : 'GOING_TO_TANZANIA',
      airports: TZ_AIRPORTS,
      boards: results.map((result, index) => result.status === 'fulfilled'
        ? result.value
        : { airport: TZ_AIRPORTS[index], type, error: String(result.reason?.message ?? result.reason) }),
    };
  }
}
