/**
 * MatchLifecycleService
 *
 * Controls the full lifecycle of a match:
 *   SCHEDULED → LIVE → HT → LIVE (2nd half) → FT
 *
 * Also manages:
 *   - Score overrides (manual correction)
 *   - Lineup submission (home + away)
 *   - Tracking activation / deactivation
 *   - Stats snapshot updates from the vision pipeline
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SportsMatch, MatchEvent } from './sports.entity';
import { VisionIngestService } from './vision-ingest.service';
import { SportsGateway } from './sports.gateway';

export interface LineupPlayer {
  playerId?: string;
  jerseyNumber: number;
  name: string;
  position: string; // GK | CB | LB | RB | CDM | CM | CAM | LW | RW | ST
  starting: boolean;
}

export interface MatchLineup {
  home: LineupPlayer[];
  away: LineupPlayer[];
}

export interface ScoreUpdate {
  homeScore: number;
  awayScore: number;
  /** Optional: record a goal event */
  goalEvent?: {
    team: 'home' | 'away';
    jerseyNumber?: number;
    playerName?: string;
    minute: number;
    type: 'GOAL' | 'OWN_GOAL' | 'PENALTY';
  };
}

@Injectable()
export class MatchLifecycleService {
  private readonly logger = new Logger(MatchLifecycleService.name);

  constructor(
    @InjectRepository(SportsMatch)
    private readonly matchRepo: Repository<SportsMatch>,
    @InjectRepository(MatchEvent)
    private readonly eventRepo: Repository<MatchEvent>,
    private readonly vision: VisionIngestService,
    private readonly gateway: SportsGateway,
  ) {}

  // ── Lifecycle transitions ──────────────────────────────────────────────────

  async startMatch(matchId: string, ownerId: string): Promise<SportsMatch> {
    const match = await this.getOwned(matchId, ownerId);
    if (!['SCHEDULED', 'HT'].includes(match.status)) {
      throw new BadRequestException(`Cannot start match in status ${match.status}`);
    }
    const isSecondHalf = match.status === 'HT';
    match.status = 'LIVE';
    match.currentHalf = isSecondHalf ? 2 : 1;
    match.trackingActive = true;
    if (!isSecondHalf) match.startedAt = new Date();
    await this.matchRepo.save(match);
    this.logger.log(`Match ${matchId} started (half ${match.currentHalf})`);
    this.broadcastLifecycle(matchId, 'match:started', { half: match.currentHalf });
    return match;
  }

  async halfTime(matchId: string, ownerId: string): Promise<SportsMatch> {
    const match = await this.getOwned(matchId, ownerId);
    if (match.status !== 'LIVE' || match.currentHalf !== 1) {
      throw new BadRequestException('Match must be LIVE in 1st half to call half-time');
    }
    match.status = 'HT';
    match.trackingActive = false;
    await this.matchRepo.save(match);
    this.broadcastLifecycle(matchId, 'match:halftime', {});
    return match;
  }

  async endMatch(matchId: string, ownerId: string): Promise<SportsMatch> {
    const match = await this.getOwned(matchId, ownerId);
    if (!['LIVE', 'HT'].includes(match.status)) {
      throw new BadRequestException(`Cannot end match in status ${match.status}`);
    }
    match.status = 'FT';
    match.trackingActive = false;
    match.endedAt = new Date();
    await this.matchRepo.save(match);
    this.logger.log(`Match ${matchId} ended — ${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam}`);
    this.broadcastLifecycle(matchId, 'match:ended', {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    });
    return match;
  }

  async postponeMatch(matchId: string, ownerId: string): Promise<SportsMatch> {
    const match = await this.getOwned(matchId, ownerId);
    match.status = 'POSTPONED';
    match.trackingActive = false;
    await this.matchRepo.save(match);
    return match;
  }

  // ── Score management ───────────────────────────────────────────────────────

  async updateScore(matchId: string, ownerId: string, update: ScoreUpdate): Promise<SportsMatch> {
    const match = await this.getOwned(matchId, ownerId);
    match.homeScore = update.homeScore;
    match.awayScore = update.awayScore;
    await this.matchRepo.save(match);

    // Persist goal event if provided
    if (update.goalEvent) {
      const { goalEvent } = update;
      await this.eventRepo.save(
        this.eventRepo.create({
          ownerId,
          matchId,
          type: goalEvent.type,
          minute: goalEvent.minute,
          team: goalEvent.team,
          playerName: goalEvent.playerName,
          description: goalEvent.playerName
            ? `${goalEvent.playerName} (${goalEvent.type})`
            : goalEvent.type,
        }),
      );
    }

    this.broadcastLifecycle(matchId, 'match:score', {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    });
    return match;
  }

  // ── Lineup management ──────────────────────────────────────────────────────

  async setLineup(matchId: string, ownerId: string, lineup: MatchLineup): Promise<SportsMatch> {
    const match = await this.getOwned(matchId, ownerId);
    if (lineup.home.length > 18 || lineup.away.length > 18) {
      throw new BadRequestException('Maximum 18 players per team (11 starting + 7 subs)');
    }
    match.homeLineup = lineup.home as unknown as Record<string, unknown>;
    match.awayLineup = lineup.away as unknown as Record<string, unknown>;
    await this.matchRepo.save(match);
    return match;
  }

  async getLineup(matchId: string): Promise<MatchLineup> {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    return {
      home: (match.homeLineup as unknown as LineupPlayer[]) ?? [],
      away: (match.awayLineup as unknown as LineupPlayer[]) ?? [],
    };
  }

  // ── Tracking control ───────────────────────────────────────────────────────

  async setTracking(matchId: string, ownerId: string, active: boolean): Promise<SportsMatch> {
    const match = await this.getOwned(matchId, ownerId);
    match.trackingActive = active;
    await this.matchRepo.save(match);
    this.logger.log(`Tracking ${active ? 'enabled' : 'disabled'} for match ${matchId}`);
    return match;
  }

  /** Called by VisionIngestService to update the match clock */
  async updateClock(matchId: string, minute: number, half: number): Promise<void> {
    await this.matchRepo.update(matchId, { currentMinute: minute, currentHalf: half });
  }

  /** Get all currently live matches (for the Python pipeline to discover) */
  async getLiveMatches(): Promise<SportsMatch[]> {
    return this.matchRepo.find({ where: { status: 'LIVE', trackingActive: true } });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getOwned(matchId: string, ownerId: string): Promise<SportsMatch> {
    const match = await this.matchRepo.findOne({ where: { id: matchId, ownerId } });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  private broadcastLifecycle(matchId: string, event: string, data: Record<string, unknown>) {
    try {
      this.gateway.server?.to(`match:${matchId}`).emit(event, { matchId, ...data });
    } catch { /* gateway may not be ready */ }
  }
}
