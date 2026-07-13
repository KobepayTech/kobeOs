import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MatchAnalytics, MatchEvent, SportsMatch, SportsPlayer, SportsTeam,
  PlayerSeasonStats, CameraSession,
} from './sports.entity';
import { AnalyticsService, MatchEventsService, MatchesService, PlayersService, TeamsService } from './sports.service';
import { SportsController } from './sports.controller';
import { SportsGateway } from './sports.gateway';
import { VisionIngestService } from './vision-ingest.service';
import { OffsideDetectionService } from './offside-detection.service';
import { MatchLifecycleService } from './match-lifecycle.service';
import { PlayerStatsService } from './player-stats.service';
import { CameraService } from './camera.service';
import { SportsAiService } from './sports-ai.service';
import { BoxingFighter, BoxingBout } from './boxing.entity';
import { BoxingService } from './boxing.service';
import { BoxingController } from './boxing.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SportsMatch, MatchEvent, SportsPlayer, SportsTeam, MatchAnalytics,
      PlayerSeasonStats, CameraSession,
      BoxingFighter, BoxingBout,
    ]),
    AiModule,
  ],
  providers: [
    MatchesService, MatchEventsService, PlayersService, TeamsService, AnalyticsService,
    VisionIngestService, OffsideDetectionService, SportsGateway,
    MatchLifecycleService, PlayerStatsService, CameraService, SportsAiService,
    BoxingService,
  ],
  controllers: [SportsController, BoxingController],
  exports: [
    MatchesService, AnalyticsService, VisionIngestService, OffsideDetectionService,
    SportsGateway, MatchLifecycleService, PlayerStatsService, CameraService, SportsAiService,
  ],
})
export class SportsModule {}
