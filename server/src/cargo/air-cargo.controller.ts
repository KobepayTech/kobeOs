import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AirCargoService } from './air-cargo.service';
import { CreateAirHubDto, CreateAirlineDto, CreateRoutePlanDto } from './dto/air-route.dto';
import { CreateCustomsFlowDto, CreateLastMileDto, CreateTrackingEventDto, UpdateDeliveryProofDto } from './dto/air-ops.dto';

@UseGuards(JwtAuthGuard)
@Controller('cargo/air')
export class AirCargoController {
  constructor(private readonly air: AirCargoService) {}

  @Get('hubs') hubs(@CurrentUser('id') uid: string) { return this.air.listHubs(uid); }
  @Post('hubs') createHub(@CurrentUser('id') uid: string, @Body() dto: CreateAirHubDto) { return this.air.createHub(uid, dto); }

  @Get('airlines') airlines(@CurrentUser('id') uid: string) { return this.air.listAirlines(uid); }
  @Post('airlines') createAirline(@CurrentUser('id') uid: string, @Body() dto: CreateAirlineDto) { return this.air.createAirline(uid, dto); }

  @Get('routes') routes(@CurrentUser('id') uid: string) { return this.air.listRoutes(uid); }
  @Post('routes') createRoute(@CurrentUser('id') uid: string, @Body() dto: CreateRoutePlanDto) { return this.air.createRoute(uid, dto); }
  @Get('routes/:id') route(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.air.getRoute(uid, id); }
  @Post('routes/:id/reroute') reroute(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.air.reroute(uid, id); }
  @Post('routes/:id/assess') assess(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.air.assess(uid, id); }

  @Get('customs') customs(@CurrentUser('id') uid: string) { return this.air.listCustoms(uid); }
  @Post('customs') createCustoms(@CurrentUser('id') uid: string, @Body() dto: CreateCustomsFlowDto) { return this.air.createCustoms(uid, dto); }

  @Get('events') events(@CurrentUser('id') uid: string, @Query('shipmentId') shipmentId?: string) { return this.air.listEvents(uid, shipmentId); }
  @Post('events') createEvent(@CurrentUser('id') uid: string, @Body() dto: CreateTrackingEventDto) { return this.air.createEvent(uid, dto); }

  @Get('deliveries') deliveries(@CurrentUser('id') uid: string) { return this.air.listDeliveries(uid); }
  @Post('deliveries') createDelivery(@CurrentUser('id') uid: string, @Body() dto: CreateLastMileDto) { return this.air.createDelivery(uid, dto); }
  @Patch('deliveries/:id/proof') proof(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateDeliveryProofDto) { return this.air.proof(uid, id, dto); }

  @Get('analytics') analytics(@CurrentUser('id') uid: string, @Query('period') period?: string) { return this.air.analytics(uid, period); }
}
