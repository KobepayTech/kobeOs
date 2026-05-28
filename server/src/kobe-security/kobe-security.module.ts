import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityClient } from './security-client.entity';
import { ClientSite } from './client-site.entity';
import { TeamMember } from './team-member.entity';
import { ServiceRoute } from './service-route.entity';
import { ServiceCheck } from './service-check.entity';
import { SiteSignal } from './site-signal.entity';
import { WorkItem } from './work-item.entity';
import { KobeSecurityController } from './kobe-security.controller';
import { RuViewSignalIngestService } from './signal-ingest.service';
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

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      SecurityClient,
      ClientSite,
      TeamMember,
      ServiceRoute,
      ServiceCheck,
      SiteSignal,
      WorkItem,
    ]),
  ],
  controllers: [KobeSecurityController],
  providers: [
    SecurityClientsService,
    ClientSitesService,
    TeamMembersService,
    ServiceRoutesService,
    ServiceChecksService,
    SiteSignalsService,
    WorkItemsService,
    KobeSecurityDashboardService,
    RuViewSignalIngestService,
  ],
})
export class KobeSecurityModule {}
