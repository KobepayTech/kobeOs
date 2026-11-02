import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform/platform.module';
import { BRIEFING_ENTITIES, BusinessBriefingService } from './business-briefing.service';
import { BusinessFoundationsController } from './business-foundations.controller';
@Module({ imports: [TypeOrmModule.forFeature(BRIEFING_ENTITIES), PlatformModule], controllers: [BusinessFoundationsController], providers: [BusinessBriefingService], exports: [BusinessBriefingService] })
export class BusinessFoundationsModule {}
