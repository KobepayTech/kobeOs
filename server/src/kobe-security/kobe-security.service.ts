import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnedCrudService } from '../common/owned.service';
import { SecurityClient } from './security-client.entity';
import { ClientSite } from './client-site.entity';
import { TeamMember } from './team-member.entity';
import { ServiceRoute } from './service-route.entity';
import { ServiceCheck } from './service-check.entity';
import { SiteSignal } from './site-signal.entity';
import { WorkItem } from './work-item.entity';

@Injectable()
export class SecurityClientsService extends OwnedCrudService<SecurityClient> {
  constructor(@InjectRepository(SecurityClient) repo: Repository<SecurityClient>) { super(repo); }
}

@Injectable()
export class ClientSitesService extends OwnedCrudService<ClientSite> {
  constructor(@InjectRepository(ClientSite) repo: Repository<ClientSite>) { super(repo); }
}

@Injectable()
export class TeamMembersService extends OwnedCrudService<TeamMember> {
  constructor(@InjectRepository(TeamMember) repo: Repository<TeamMember>) { super(repo); }
}

@Injectable()
export class ServiceRoutesService extends OwnedCrudService<ServiceRoute> {
  constructor(@InjectRepository(ServiceRoute) repo: Repository<ServiceRoute>) { super(repo); }
}

@Injectable()
export class ServiceChecksService extends OwnedCrudService<ServiceCheck> {
  constructor(@InjectRepository(ServiceCheck) repo: Repository<ServiceCheck>) { super(repo); }
}

@Injectable()
export class SiteSignalsService extends OwnedCrudService<SiteSignal> {
  constructor(@InjectRepository(SiteSignal) repo: Repository<SiteSignal>) { super(repo); }
}

@Injectable()
export class WorkItemsService extends OwnedCrudService<WorkItem> {
  constructor(@InjectRepository(WorkItem) repo: Repository<WorkItem>) { super(repo); }
}

@Injectable()
export class KobeSecurityDashboardService {
  constructor(
    private readonly clients: SecurityClientsService,
    private readonly sites: ClientSitesService,
    private readonly members: TeamMembersService,
    private readonly routes: ServiceRoutesService,
    private readonly checks: ServiceChecksService,
    private readonly signals: SiteSignalsService,
    private readonly workItems: WorkItemsService,
  ) {}

  async summary(ownerId: string) {
    const [clients, sites, members, routes, checks, signals, workItems] = await Promise.all([
      this.clients.count(ownerId),
      this.sites.count(ownerId),
      this.members.count(ownerId),
      this.routes.count(ownerId),
      this.checks.count(ownerId),
      this.signals.count(ownerId),
      this.workItems.count(ownerId),
    ]);

    return { clients, sites, members, routes, checks, signals, workItems };
  }
}
