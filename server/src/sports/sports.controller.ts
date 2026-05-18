import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AnalyticsService, MatchEventsService, MatchesService, PlayersService, TeamsService } from './sports.service';
import { VisionIngestService } from './vision-ingest.service';
import { OffsideDetectionService } from './offside-detection.service';
import { SportsGateway } from './sports.gateway';
import {
  CreateMatchDto, CreateMatchEventDto, CreatePlayerDto, CreateTeamDto,
  UpdateAnalyticsDto, UpdateMatchDto, UpdatePlayerDto, UpdateTeamDto,
  IngestFrameDto, CheckOffsideDto,
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
    private readonly vision: VisionIngestService,
    private readonly offside: OffsideDetectionService,
    private readonly gateway: SportsGateway,
  ) {}

  // ── AI Vision ingest (called by Python YOLO/ByteTrack pipeline) ───────────

  /**
   * Receive a processed frame from the AI vision pipeline.
   * The Python process posts this after every YOLO detection + ByteTrack pass.
   * No auth guard — secured by a shared VISION_INGEST_SECRET header instead.
   */
  @Post('vision/ingest/:matchId')
  @ApiOperation({ summary: 'Ingest a processed vision frame from the AI pipeline' })
  ingestFrame(
    @Param('matchId') matchId: string,
    @Body() dto: IngestFrameDto,
  ) {
    return this.vision.ingestFrame(matchId, dto);
  }

  /** Get the current live match state (positions, stats, events) for a match. */
  @Get('vision/state/:matchId')
  @ApiOperation({ summary: 'Get current live match state from vision pipeline' })
  getLiveState(@Param('matchId') matchId: string) {
    return this.vision.getLiveState(matchId);
  }

  /** Get all active (live) matches being tracked by the vision pipeline. */
  @Get('vision/active')
  @ApiOperation({ summary: 'List matches currently being tracked by the vision pipeline' })
  getActiveMatches() {
    return this.vision.getActiveMatches();
  }

  // ── Offside detection ─────────────────────────────────────────────────────

  /**
   * Check offside for a specific frame.
   * Called by the vision pipeline when it detects a potential pass event.
   */
  @Post('offside/check/:matchId')
  @ApiOperation({ summary: 'Run offside detection on a frame snapshot' })
  checkOffside(
    @Param('matchId') matchId: string,
    @Body() dto: CheckOffsideDto,
  ) {
    const result = this.offside.check(matchId, dto);
    // Push result to all WebSocket clients watching this match
    this.gateway.pushOffsideResult(matchId, result);
    return result;
  }

  /** Get all offside events for a match. */
  @Get('offside/events/:matchId')
  @ApiOperation({ summary: 'Get all offside events for a match' })
  getOffsideEvents(@Param('matchId') matchId: string) {
    return this.offside.getEvents(matchId);
  }

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
