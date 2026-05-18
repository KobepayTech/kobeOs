/**
 * PlayerStatsService
 *
 * Accumulates per-player statistics from vision pipeline data.
 * Called at match end (or periodically) to update season aggregates.
 *
 * Stats sources:
 *   - VisionIngestService.getLiveState() → distance, sprints, speed
 *   - MatchAnalytics.xgData → xG contributions
 *   - MatchEvent records → goals, assists, cards
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerSeasonStats, SportsMatch, MatchEvent, SportsPlayer } from './sports.entity';
import { VisionIngestService } from './vision-ingest.service';

export interface MatchPlayerStat {
  playerId: string;
  jerseyNumber: number;
  name: string;
  team: 'home' | 'away';
  minutesPlayed: number;
  distanceKm: number;
  sprints: number;
  topSpeedKmh: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  xg: number;
  rating: number; // 0–100
}

@Injectable()
export class PlayerStatsService {
  private readonly logger = new Logger(PlayerStatsService.name);

  constructor(
    @InjectRepository(PlayerSeasonStats)
    private readonly statsRepo: Repository<PlayerSeasonStats>,
    @InjectRepository(SportsMatch)
    private readonly matchRepo: Repository<SportsMatch>,
    @InjectRepository(MatchEvent)
    private readonly eventRepo: Repository<MatchEvent>,
    @InjectRepository(SportsPlayer)
    private readonly playerRepo: Repository<SportsPlayer>,
    private readonly vision: VisionIngestService,
  ) {}

  // ── Per-match stats snapshot ───────────────────────────────────────────────

  /**
   * Build per-player stats for a match from vision data + DB events.
   * Called on demand (e.g. at FT or from the dashboard).
   */
  async getMatchStats(matchId: string): Promise<MatchPlayerStat[]> {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) return [];

    const liveState = this.vision.getLiveState(matchId);
    const events = await this.eventRepo.find({ where: { matchId } });

    // Build lineup map from match lineups
    const homeLineup = (match.homeLineup as unknown as Array<{ playerId?: string; jerseyNumber: number; name: string; position: string }>) ?? [];
    const awayLineup = (match.awayLineup as unknown as Array<{ playerId?: string; jerseyNumber: number; name: string; position: string }>) ?? [];

    const allPlayers = [
      ...homeLineup.map((p) => ({ ...p, team: 'home' as const })),
      ...awayLineup.map((p) => ({ ...p, team: 'away' as const })),
    ];

    return allPlayers.map((p) => {
      // Match vision track by jersey number
      const track = liveState?.players.find(
        (t) => t.jerseyNumber === p.jerseyNumber && t.class.includes(p.team),
      );

      // Count events for this player
      const playerEvents = events.filter(
        (e) => e.team === p.team && e.playerName === p.name,
      );

      const goals = playerEvents.filter((e) => e.type === 'GOAL').length;
      const yellowCards = playerEvents.filter((e) => e.type === 'YELLOW_CARD').length;
      const redCards = playerEvents.filter((e) => e.type === 'RED_CARD').length;

      // xG from vision events
      const xg = liveState?.events
        .filter((e) => e.team === p.team && e.trackId === track?.trackId && (e.type === 'SHOT' || e.type === 'GOAL'))
        .reduce((sum, e) => sum + (e.xg ?? 0), 0) ?? 0;

      const distanceKm = track ? parseFloat((track.distanceM / 1000).toFixed(2)) : 0;
      const sprints = track?.sprints ?? 0;

      // Simple rating formula: base 60 + contributions
      const rating = Math.min(100, Math.round(
        60
        + goals * 8
        + (xg * 5)
        + Math.min(sprints * 0.3, 10)
        + Math.min(distanceKm * 1.5, 12)
        - yellowCards * 5
        - redCards * 15,
      ));

      const matchClock = liveState?.matchClock ?? 0;
      const minutesPlayed = Math.min(90, Math.floor(matchClock / 60));

      return {
        playerId: p.playerId ?? `${matchId}_${p.jerseyNumber}_${p.team}`,
        jerseyNumber: p.jerseyNumber,
        name: p.name,
        team: p.team,
        minutesPlayed,
        distanceKm,
        sprints,
        topSpeedKmh: parseFloat((track?.speed ?? 0).toFixed(1)),
        goals,
        assists: 0, // TODO: derive from passing network when available
        yellowCards,
        redCards,
        xg: parseFloat(xg.toFixed(3)),
        rating,
      };
    });
  }

  // ── Season aggregate update ────────────────────────────────────────────────

  /**
   * Called at match end to update season aggregates for all players.
   */
  async accumulateSeasonStats(matchId: string, ownerId: string): Promise<void> {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) return;

    const season = match.season ?? this.currentSeason();
    const matchStats = await this.getMatchStats(matchId);

    for (const stat of matchStats) {
      if (!stat.playerId) continue;

      let record = await this.statsRepo.findOne({
        where: { playerId: stat.playerId, season, ownerId },
      });

      if (!record) {
        record = this.statsRepo.create({
          ownerId,
          playerId: stat.playerId,
          season,
          competition: match.competition ?? undefined,
          matchesPlayed: 0,
          minutesPlayed: 0,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          xgTotal: 0,
          distanceKm: 0,
          sprints: 0,
          avgRating: 0,
          matchHistory: [],
        });
      }

      // Append match to history
      const history = (record.matchHistory ?? []) as Array<Record<string, unknown>>;
      history.push({
        matchId,
        date: match.kickoff,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        rating: stat.rating,
        goals: stat.goals,
        assists: stat.assists,
        distanceKm: stat.distanceKm,
        sprints: stat.sprints,
        minutesPlayed: stat.minutesPlayed,
        xg: stat.xg,
      });

      // Update aggregates
      const n = record.matchesPlayed;
      record.matchesPlayed = n + 1;
      record.minutesPlayed += stat.minutesPlayed;
      record.goals += stat.goals;
      record.assists += stat.assists;
      record.yellowCards += stat.yellowCards;
      record.redCards += stat.redCards;
      record.xgTotal = parseFloat((Number(record.xgTotal) + stat.xg).toFixed(3));
      record.distanceKm = parseFloat((Number(record.distanceKm) + stat.distanceKm).toFixed(2));
      record.sprints += stat.sprints;
      record.avgRating = parseFloat(((Number(record.avgRating) * n + stat.rating) / (n + 1)).toFixed(2));
      record.matchHistory = history as unknown as Record<string, unknown>[];

      await this.statsRepo.save(record);
    }

    this.logger.log(`Season stats updated for ${matchStats.length} players in match ${matchId}`);
  }

  async getPlayerSeasonStats(playerId: string, season?: string): Promise<PlayerSeasonStats[]> {
    if (season) {
      return this.statsRepo.find({ where: { playerId, season } });
    }
    return this.statsRepo.find({ where: { playerId } });
  }

  async getTopPlayers(ownerId: string, season: string, limit = 20): Promise<PlayerSeasonStats[]> {
    return this.statsRepo.find({
      where: { ownerId, season },
      order: { avgRating: 'DESC' },
      take: limit,
    });
  }

  private currentSeason(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  }
}
