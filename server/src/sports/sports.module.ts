import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchAnalytics, MatchEvent, SportsMatch, SportsPlayer, SportsTeam } from './sports.entity';
import { AnalyticsService, MatchEventsService, MatchesService, PlayersService, TeamsService } from './sports.service';
import { SportsController } from './sports.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SportsMatch, MatchEvent, SportsPlayer, SportsTeam, MatchAnalytics]),
    AiModule,
  ],
  providers: [MatchesService, MatchEventsService, PlayersService, TeamsService, AnalyticsService],
  controllers: [SportsController],
  exports: [MatchesService, AnalyticsService],
})
export class SportsModule {}
