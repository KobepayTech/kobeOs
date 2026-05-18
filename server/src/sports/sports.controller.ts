import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AnalyticsService, MatchEventsService, MatchesService, PlayersService, TeamsService,
} from './sports.service';
import { VisionIngestService } from './vision-ingest.service';
import { OffsideDetectionService } from './offside-detection.service';
import { SportsGateway } from './sports.gateway';
import { MatchLifecycleService } from './match-lifecycle.service';
import { PlayerStatsService } from './player-stats.service';
import { CameraService } from './camera.service';
import { SportsAiService } from './sports-ai.service';
import {
  CreateMatchDto, CreateMatchEventDto, CreatePlayerDto, CreateTeamDto,
  UpdateAnalyticsDto, UpdateMatchDto, UpdatePlayerDto, UpdateTeamDto,
  IngestFrameDto, CheckOffsideDto,
} from './dto/sports.dto';
import type { ScoreUpdate, MatchLineup } from './match-lifecycle.service';
import type { RegisterCameraDto, CameraHeartbeat } from './camera.service';

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
    private readonly lifecycle: MatchLifecycleService,
    private readonly playerStats: PlayerStatsService,
    private readonly cameras: CameraService,
    private readonly sportsAi: SportsAiService,
  ) {}

  // ── AI Vision ingest ──────────────────────────────────────────────────────

  @Post('vision/ingest/:matchId')
  @ApiOperation({ summary: 'Ingest a processed vision frame from the AI pipeline' })
  ingestFrame(@Param('matchId') matchId: string, @Body() dto: IngestFrameDto) {
    return this.vision.ingestFrame(matchId, dto);
  }

  @Get('vision/state/:matchId')
  @ApiOperation({ summary: 'Get current live match state from vision pipeline' })
  getLiveState(@Param('matchId') matchId: string) {
    return this.vision.getLiveState(matchId);
  }

  @Get('vision/active')
  @ApiOperation({ summary: 'List matches currently being tracked by the vision pipeline' })
  getActiveMatches() {
    return this.vision.getActiveMatches();
  }

  // ── Offside detection ─────────────────────────────────────────────────────

  @Post('offside/check/:matchId')
  @ApiOperation({ summary: 'Run offside detection on a frame snapshot' })
  checkOffside(@Param('matchId') matchId: string, @Body() dto: CheckOffsideDto) {
    const result = this.offside.check(matchId, dto);
    this.gateway.pushOffsideResult(matchId, result);
    return result;
  }

  @Get('offside/events/:matchId')
  @ApiOperation({ summary: 'Get all offside events for a match' })
  getOffsideEvents(@Param('matchId') matchId: string) {
    return this.offside.getEvents(matchId);
  }

  // ── Match lifecycle ───────────────────────────────────────────────────────

  @Post('matches/:id/start')
  @ApiOperation({ summary: 'Start match (SCHEDULED->LIVE or HT->LIVE for 2nd half)' })
  startMatch(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.lifecycle.startMatch(id, uid);
  }

  @Post('matches/:id/halftime')
  @ApiOperation({ summary: 'Signal half-time (LIVE->HT)' })
  halfTime(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.lifecycle.halfTime(id, uid);
  }

  @Post('matches/:id/end')
  @ApiOperation({ summary: 'End match (LIVE/HT->FT), triggers stats accumulation' })
  async endMatch(@CurrentUser('id') uid: string, @Param('id') id: string) {
    const match = await this.lifecycle.endMatch(id, uid);
    void this.playerStats.accumulateSeasonStats(id, uid);
    void this.sportsAi.generateFullTimeReport(id);
    return match;
  }

  @Post('matches/:id/postpone')
  @ApiOperation({ summary: 'Postpone match' })
  postponeMatch(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.lifecycle.postponeMatch(id, uid);
  }

  @Post('matches/:id/score')
  @ApiOperation({ summary: 'Update score (with optional goal event recording)' })
  updateScore(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() body: ScoreUpdate,
  ) {
    return this.lifecycle.updateScore(id, uid, body);
  }

  @Post('matches/:id/lineup')
  @ApiOperation({ summary: 'Submit home + away lineups (max 18 players each)' })
  setLineup(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() body: MatchLineup,
  ) {
    return this.lifecycle.setLineup(id, uid, body);
  }

  @Get('matches/:id/lineup')
  @ApiOperation({ summary: 'Get current lineups for a match' })
  getLineup(@Param('id') id: string) {
    return this.lifecycle.getLineup(id);
  }

  @Post('matches/:id/tracking')
  @ApiOperation({ summary: 'Enable or disable vision tracking for a match' })
  setTracking(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.lifecycle.setTracking(id, uid, body.active);
  }

  @Get('matches/live')
  @ApiOperation({ summary: 'Get all currently live matches with tracking active' })
  getLiveMatches() {
    return this.lifecycle.getLiveMatches();
  }

  // ── Matches ───────────────────────────────────────────────────────────────

  @Get('matches')
  @ApiOperation({ summary: 'List matches' })
  listMatches(
    @CurrentUser('id') uid: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
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
  async createEvent(@CurrentUser('id') uid: string, @Body() dto: CreateMatchEventDto) {
    const event = await this.events.createEvent(uid, dto);
    if (['GOAL', 'RED_CARD', 'PENALTY', 'VAR', 'OWN_GOAL'].includes(dto.type)) {
      void this.sportsAi.onMatchEvent(dto.matchId, {
        type: dto.type,
        minute: dto.minute,
        team: dto.team,
        playerName: dto.playerName,
        description: dto.description,
      });
    }
    return event;
  }

  @Delete('events/:id')
  removeEvent(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.events.remove(uid, id);
  }

  // ── Player stats ──────────────────────────────────────────────────────────

  @Get('matches/:matchId/player-stats')
  @ApiOperation({ summary: 'Get per-player stats for a match (vision + events)' })
  getMatchPlayerStats(@Param('matchId') matchId: string) {
    return this.playerStats.getMatchStats(matchId);
  }

  @Post('matches/:matchId/accumulate-stats')
  @ApiOperation({ summary: 'Trigger season stats accumulation for a completed match' })
  accumulateStats(@CurrentUser('id') uid: string, @Param('matchId') matchId: string) {
    return this.playerStats.accumulateSeasonStats(matchId, uid);
  }

  @Get('players/:playerId/season-stats')
  @ApiOperation({ summary: 'Get season stats for a player' })
  getPlayerSeasonStats(
    @Param('playerId') playerId: string,
    @Query('season') season?: string,
  ) {
    return this.playerStats.getPlayerSeasonStats(playerId, season);
  }

  @Get('season-stats/top')
  @ApiOperation({ summary: 'Top players by average rating for a season' })
  getTopPlayers(
    @CurrentUser('id') uid: string,
    @Query('season') season: string,
    @Query('limit') limit?: string,
  ) {
    return this.playerStats.getTopPlayers(uid, season, Number(limit) || 20);
  }

  // ── Players ───────────────────────────────────────────────────────────────

  @Get('players')
  @ApiOperation({ summary: 'List players' })
  listPlayers(
    @CurrentUser('id') uid: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
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
  listTeams(
    @CurrentUser('id') uid: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
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
  updateAnalytics(
    @CurrentUser('id') uid: string,
    @Param('matchId') matchId: string,
    @Body() dto: UpdateAnalyticsDto,
  ) {
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

  @Get('analytics/:matchId/highlights')
  @ApiOperation({ summary: 'Get highlight frame markers for video clip cutting' })
  getHighlights(@Param('matchId') matchId: string) {
    return this.sportsAi.getHighlightMarkers(matchId);
  }

  // ── Cameras ───────────────────────────────────────────────────────────────

  @Get('cameras')
  @ApiOperation({ summary: 'List all cameras and their status' })
  listCameras() {
    return this.cameras.list();
  }

  @Get('cameras/status')
  @ApiOperation({ summary: 'Camera system status (online/offline counts)' })
  cameraStatus() {
    return this.cameras.getSystemStatus();
  }

  @Post('cameras')
  @ApiOperation({ summary: 'Register a new camera' })
  registerCamera(@Body() dto: RegisterCameraDto) {
    return this.cameras.register(dto);
  }

  @Post('cameras/heartbeat')
  @ApiOperation({ summary: 'Receive heartbeat from Python pipeline (fps, resolution, status)' })
  cameraHeartbeat(@Body() hb: CameraHeartbeat) {
    return this.cameras.heartbeat(hb);
  }

  @Post('cameras/:id/homography')
  @ApiOperation({ summary: 'Store calibrated homography matrix for a camera' })
  setHomography(@Param('id') id: string, @Body() body: { matrix: number[][] }) {
    return this.cameras.setHomography(id, body.matrix);
  }

  @Post('cameras/:id/assign/:matchId')
  @ApiOperation({ summary: 'Assign camera to a match' })
  assignCamera(@Param('id') id: string, @Param('matchId') matchId: string) {
    return this.cameras.assignToMatch(id, matchId);
  }

  @Post('cameras/:id/release')
  @ApiOperation({ summary: 'Release camera from its current match' })
  releaseCamera(@Param('id') id: string) {
    return this.cameras.releaseFromMatch(id);
  }

  @Get('cameras/match/:matchId')
  @ApiOperation({ summary: 'Get cameras assigned to a match' })
  getCamerasForMatch(@Param('matchId') matchId: string) {
    return this.cameras.getCamerasForMatch(matchId);
  }

  @Delete('cameras/:id')
  removeCamera(@Param('id') id: string) {
    return this.cameras.remove(id);
  }
}
