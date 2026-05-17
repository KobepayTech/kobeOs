import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchAnalytics, MatchEvent, SportsMatch, SportsPlayer, SportsTeam } from './sports.entity';
import { OwnedCrudService } from '../common/owned.service';
import { AiService } from '../ai/ai.service';
import type {
  CreateMatchDto, CreateMatchEventDto, CreatePlayerDto, CreateTeamDto,
  UpdateAnalyticsDto, UpdateMatchDto, UpdatePlayerDto, UpdateTeamDto,
} from './dto/sports.dto';

@Injectable()
export class MatchesService extends OwnedCrudService<SportsMatch> {
  constructor(
    @InjectRepository(SportsMatch) repo: Repository<SportsMatch>,
    private readonly ai: AiService,
  ) {
    super(repo);
  }

  async createMatch(ownerId: string, dto: CreateMatchDto): Promise<SportsMatch> {
    return this.create(ownerId, { ...dto, kickoff: new Date(dto.kickoff) });
  }

  async updateMatch(ownerId: string, id: string, dto: UpdateMatchDto): Promise<SportsMatch> {
    return this.update(ownerId, id, dto);
  }

  /** Generate an AI post-match report and store it on the match record. */
  async generateAiReport(ownerId: string, matchId: string): Promise<SportsMatch> {
    const match = await this.get(ownerId, matchId);
    const report = await this.ai.generateMatchReport({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      score: `${match.homeScore}-${match.awayScore}`,
      competition: match.competition,
      stats: match.stats,
    });
    return this.update(ownerId, matchId, { aiReport: report });
  }
}

@Injectable()
export class MatchEventsService extends OwnedCrudService<MatchEvent> {
  constructor(@InjectRepository(MatchEvent) repo: Repository<MatchEvent>) {
    super(repo);
  }

  async createEvent(ownerId: string, dto: CreateMatchEventDto): Promise<MatchEvent> {
    return this.create(ownerId, dto);
  }

  async getMatchEvents(ownerId: string, matchId: string): Promise<MatchEvent[]> {
    return this.repo.find({
      where: { matchId, ownerId },
      order: { minute: 'ASC' },
    });
  }
}

@Injectable()
export class PlayersService extends OwnedCrudService<SportsPlayer> {
  constructor(@InjectRepository(SportsPlayer) repo: Repository<SportsPlayer>) {
    super(repo);
  }

  createPlayer(ownerId: string, dto: CreatePlayerDto): Promise<SportsPlayer> {
    return this.create(ownerId, dto);
  }

  updatePlayer(ownerId: string, id: string, dto: UpdatePlayerDto): Promise<SportsPlayer> {
    return this.update(ownerId, id, dto);
  }
}

@Injectable()
export class TeamsService extends OwnedCrudService<SportsTeam> {
  constructor(@InjectRepository(SportsTeam) repo: Repository<SportsTeam>) {
    super(repo);
  }

  createTeam(ownerId: string, dto: CreateTeamDto): Promise<SportsTeam> {
    return this.create(ownerId, dto);
  }

  updateTeam(ownerId: string, id: string, dto: UpdateTeamDto): Promise<SportsTeam> {
    return this.update(ownerId, id, dto);
  }

  /** Return teams sorted by points (league table). */
  async leagueTable(ownerId: string, competition: string): Promise<SportsTeam[]> {
    return this.repo.find({
      where: { ownerId, competition },
      order: { points: 'DESC', goalsFor: 'DESC' },
    });
  }
}

@Injectable()
export class AnalyticsService extends OwnedCrudService<MatchAnalytics> {
  constructor(
    @InjectRepository(MatchAnalytics) repo: Repository<MatchAnalytics>,
    private readonly ai: AiService,
  ) {
    super(repo);
  }

  async getOrCreateForMatch(ownerId: string, matchId: string): Promise<MatchAnalytics> {
    const existing = await this.repo.findOne({ where: { matchId, ownerId } });
    if (existing) return existing;
    return this.create(ownerId, { matchId, status: 'PENDING' });
  }

  async updateAnalytics(ownerId: string, matchId: string, dto: UpdateAnalyticsDto): Promise<MatchAnalytics> {
    const analytics = await this.getOrCreateForMatch(ownerId, matchId);
    return this.update(ownerId, analytics.id, { ...dto, status: 'COMPLETE' });
  }

  /** Generate AI tactical report from stored analytics data. */
  async generateTacticalReport(ownerId: string, matchId: string): Promise<MatchAnalytics> {
    const analytics = await this.repo.findOne({ where: { matchId, ownerId } });
    if (!analytics) throw new NotFoundException('Analytics not found for this match');

    const report = await this.ai.analyseMatchStats({
      possession: analytics.possession,
      passingNetwork: analytics.passingNetwork,
      formations: analytics.formations,
      xgData: analytics.xgData,
    });

    return this.update(ownerId, analytics.id, { aiTacticalReport: report });
  }

  /** Generate AI live commentary from current match state. */
  async generateCommentary(ownerId: string, matchId: string, context: string): Promise<string> {
    const commentary = await this.ai.generateMatchCommentary(context);
    const analytics = await this.getOrCreateForMatch(ownerId, matchId);
    await this.update(ownerId, analytics.id, { aiCommentary: commentary });
    return commentary;
  }
}
