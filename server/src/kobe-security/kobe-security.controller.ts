import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  ClientSitesService,
  KobeSecurityDashboardService,
  SecurityClientsService,
  ServiceChecksService,
  ServiceRoutesService,
  SiteSignalsService,
  TeamMembersService,
  WorkItemsService,
} from './kobe-security.service';
import {
  CreateClientSiteDto,
  CreateSecurityClientDto,
  CreateServiceCheckDto,
  CreateServiceRouteDto,
  CreateSiteSignalDto,
  CreateTeamMemberDto,
  CreateWorkItemDto,
  UpdateClientSiteDto,
  UpdateSecurityClientDto,
  UpdateServiceCheckDto,
  UpdateServiceRouteDto,
  UpdateSiteSignalDto,
  UpdateTeamMemberDto,
  UpdateWorkItemDto,
} from './dto/kobe-security.dto';

@UseGuards(JwtAuthGuard)
@Controller('security')
export class KobeSecurityController {
  constructor(
    private readonly dashboard: KobeSecurityDashboardService,
    private readonly clients: SecurityClientsService,
    private readonly sites: ClientSitesService,
    private readonly members: TeamMembersService,
    private readonly routes: ServiceRoutesService,
    private readonly checks: ServiceChecksService,
    private readonly signals: SiteSignalsService,
    private readonly workItems: WorkItemsService,
  ) {}

  @Get('summary') summary(@CurrentUser('id') uid: string) { return this.dashboard.summary(uid); }

  @Get('clients') listClients(@CurrentUser('id') uid: string) { return this.clients.list(uid); }
  @Post('clients') createClient(@CurrentUser('id') uid: string, @Body() dto: CreateSecurityClientDto) { return this.clients.create(uid, dto); }
  @Patch('clients/:id') updateClient(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateSecurityClientDto) { return this.clients.update(uid, id, dto); }
  @Delete('clients/:id') deleteClient(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.clients.remove(uid, id); }

  @Get('sites') listSites(@CurrentUser('id') uid: string) { return this.sites.list(uid); }
  @Post('sites') createSite(@CurrentUser('id') uid: string, @Body() dto: CreateClientSiteDto) { return this.sites.create(uid, dto); }
  @Patch('sites/:id') updateSite(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateClientSiteDto) { return this.sites.update(uid, id, dto); }
  @Delete('sites/:id') deleteSite(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.sites.remove(uid, id); }

  @Get('members') listMembers(@CurrentUser('id') uid: string) { return this.members.list(uid); }
  @Post('members') createMember(@CurrentUser('id') uid: string, @Body() dto: CreateTeamMemberDto) { return this.members.create(uid, dto); }
  @Patch('members/:id') updateMember(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateTeamMemberDto) { return this.members.update(uid, id, dto); }
  @Delete('members/:id') deleteMember(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.members.remove(uid, id); }

  @Get('routes') listRoutes(@CurrentUser('id') uid: string) { return this.routes.list(uid); }
  @Post('routes') createRoute(@CurrentUser('id') uid: string, @Body() dto: CreateServiceRouteDto) { return this.routes.create(uid, dto); }
  @Patch('routes/:id') updateRoute(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateServiceRouteDto) { return this.routes.update(uid, id, dto); }
  @Delete('routes/:id') deleteRoute(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.routes.remove(uid, id); }

  @Get('checks') listChecks(@CurrentUser('id') uid: string) { return this.checks.list(uid); }
  @Post('checks') createCheck(@CurrentUser('id') uid: string, @Body() dto: CreateServiceCheckDto) { return this.checks.create(uid, dto); }
  @Patch('checks/:id') updateCheck(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateServiceCheckDto) { return this.checks.update(uid, id, dto); }
  @Delete('checks/:id') deleteCheck(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.checks.remove(uid, id); }

  @Get('signals') listSignals(@CurrentUser('id') uid: string) { return this.signals.list(uid); }
  @Post('signals') createSignal(@CurrentUser('id') uid: string, @Body() dto: CreateSiteSignalDto) { return this.signals.create(uid, dto); }
  @Patch('signals/:id') updateSignal(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateSiteSignalDto) { return this.signals.update(uid, id, dto); }
  @Delete('signals/:id') deleteSignal(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.signals.remove(uid, id); }

  @Get('work-items') listWorkItems(@CurrentUser('id') uid: string) { return this.workItems.list(uid); }
  @Post('work-items') createWorkItem(@CurrentUser('id') uid: string, @Body() dto: CreateWorkItemDto) { return this.workItems.create(uid, dto); }
  @Patch('work-items/:id') updateWorkItem(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateWorkItemDto) { return this.workItems.update(uid, id, dto); }
  @Delete('work-items/:id') deleteWorkItem(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.workItems.remove(uid, id); }
}
