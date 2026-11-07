import { WorkspaceAccessController } from './workspace-access.controller';
import { WorkspaceAccessService } from './workspace-access.service';
import { User } from '../users/user.entity';
import { AiOperatingAudit } from '../ai/ai-operating.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform/platform.module';
import { BRIEFING_ENTITIES, BusinessBriefingService } from './business-briefing.service';
import { BusinessFoundationsController } from './business-foundations.controller';
@Module({ imports: [TypeOrmModule.forFeature([...BRIEFING_ENTITIES, User, AiOperatingAudit]), PlatformModule], controllers: [BusinessFoundationsController, WorkspaceAccessController], providers: [BusinessBriefingService, WorkspaceAccessService], exports: [BusinessBriefingService] })
export class BusinessFoundationsModule {}
