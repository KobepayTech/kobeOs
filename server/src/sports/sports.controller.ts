import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AnalyticsService, MatchEventsService, MatchesService, PlayersService, TeamsService } from './sports.service';
import {
  CreateMatchDto, CreateMatchEventDto, CreatePlayerDto, CreateTeamDto,
  UpdateAnalyticsDto, UpdateMatchDto, UpdatePlayerDto, UpdateTeamDto,
} from './dto/sports.dto';

@ApiTags('Sports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sports')
export class SportsController {
  constructor(
    private readonly matches: MatchesService,
    private readonly events: MatchEventsService,
    private readonly players: PlayersService,
    private readonly teams: TeamsService,
    private readonly analytics: AnalyticsService,
  ) {}

  // ── Matches ───────────────────────────────────────────────────────────────

  @Get('matches')
  @ApiOperation({ summary: 'List matches' })
  listMatches(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.matches.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }

  @Post('matches')
  @ApiOperation({ summary: 'Create a match' })
  createMatch(@CurrentUser('id') uid: string, @Body() dto: CreateMatchDto) {
    return this.matches.createMatch(uid, dto);
  }

  @Patch('matches/:id')
  @ApiOperation({ summary: 'Update match score / status / lineups' })
  updateMatch(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateMatchDto) {
    return this.matches.updateMatch(uid, id, dto);
  }

  @Post('matches/:id/ai-report')
  @ApiOperation({ summary: 'Generate AI post-match report' })
  aiReport(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.matches.generateAiReport(uid, id);
  }

  @Delete('matches/:id')
  removeMatch(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.matches.remove(uid, id);
  }

  // ── Match Events ──────────────────────────────────────────────────────────

  @Get('matches/:matchId/events')
  @ApiOperation({ summary: 'Get all events for a match (goals, cards, etc.)' })
  getEvents(@CurrentUser('id') uid: string, @Param('matchId') matchId: string) {
    return this.events.getMatchEvents(uid, matchId);
  }

  @Post('events')
  @ApiOperation({ summary: 'Record a match event (goal, card, offside, VAR...)' })
  createEvent(@CurrentUser('id') uid: string, @Body() dto: CreateMatchEventDto) {
    return this.events.createEvent(uid, dto);
  }

  @Delete('events/:id')
  removeEvent(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.events.remove(uid, id);
  }

  // ── Players ───────────────────────────────────────────────────────────────

  @Get('players')
  @ApiOperation({ summary: 'List players' })
  listPlayers(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.players.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }

  @Post('players')
  @ApiOperation({ summary: 'Create a player' })
  createPlayer(@CurrentUser('id') uid: string, @Body() dto: CreatePlayerDto) {
    return this.players.createPlayer(uid, dto);
  }

  @Patch('players/:id')
  @ApiOperation({ summary: 'Update player stats / position' })
  updatePlayer(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePlayerDto) {
    return this.players.updatePlayer(uid, id, dto);
  }

  @Delete('players/:id')
  removePlayer(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.players.remove(uid, id);
  }

  // ── Teams ─────────────────────────────────────────────────────────────────

  @Get('teams')
  @ApiOperation({ summary: 'List teams' })
  listTeams(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.teams.list(uid, { page: Number(page) || 1, limit: Number(limit) || 50 });
  }

  @Get('teams/table/:competition')
  @ApiOperation({ summary: 'League table sorted by points' })
  leagueTable(@CurrentUser('id') uid: string, @Param('competition') competition: string) {
    return this.teams.leagueTable(uid, competition);
  }

  @Post('teams')
  @ApiOperation({ summary: 'Create a team' })
  createTeam(@CurrentUser('id') uid: string, @Body() dto: CreateTeamDto) {
    return this.teams.createTeam(uid, dto);
  }

  @Patch('teams/:id')
  @ApiOperation({ summary: 'Update team stats' })
  updateTeam(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teams.updateTeam(uid, id, dto);
  }

  @Delete('teams/:id')
  removeTeam(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.teams.remove(uid, id);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Get('analytics/:matchId')
  @ApiOperation({ summary: 'Get analytics for a match (heatmaps, possession, xG, tracking)' })
  getAnalytics(@CurrentUser('id') uid: string, @Param('matchId') matchId: string) {
    return this.analytics.getOrCreateForMatch(uid, matchId);
  }

  @Patch('analytics/:matchId')
  @ApiOperation({ summary: 'Push analytics data (from YOLO/ByteTrack pipeline)' })
  updateAnalytics(@CurrentUser('id') uid: string, @Param('matchId') matchId: string, @Body() dto: UpdateAnalyticsDto) {
    return this.analytics.updateAnalytics(uid, matchId, dto);
  }

  @Post('analytics/:matchId/tactical-report')
  @ApiOperation({ summary: 'Generate AI tactical report from stored analytics' })
  tacticalReport(@CurrentUser('id') uid: string, @Param('matchId') matchId: string) {
    return this.analytics.generateTacticalReport(uid, matchId);
  }

  @Post('analytics/:matchId/commentary')
  @ApiOperation({ summary: 'Generate AI live commentary' })
  async commentary(
    @CurrentUser('id') uid: string,
    @Param('matchId') matchId: string,
    @Body() body: { context: string },
  ) {
    const content = await this.analytics.generateCommentary(uid, matchId, body.context);
    return { content };
  }
}
