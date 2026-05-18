/**
 * VisionIngestService
 *
 * Receives processed frames from the Python AI vision pipeline
 * (YOLO v8 detection + ByteTrack multi-object tracking) and:
 *
 *  1. Maintains an in-memory live match state per matchId
 *  2. Accumulates heatmap grids (10×13 cells, pitch-normalised)
 *  3. Computes rolling possession percentages
 *  4. Detects and records match events (goals, passes, shots, fouls)
 *  5. Calculates per-shot xG using a logistic model based on shot distance + angle
 *  6. Persists analytics snapshots to the DB every 30 seconds
 *  7. Notifies the SportsGateway so it can push frames to connected clients
 *
 * Frame coordinate system (pitch-normalised):
 *   X: 0 = left goal line → 100 = right goal line
 *   Y: 0 = top touchline  → 100 = bottom touchline
 *   Ball at centre spot = (50, 50)
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchAnalytics, MatchEvent, SportsMatch } from './sports.entity';
import type { IngestFrameDto, TrackedObject } from './dto/sports.dto';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEATMAP_ROWS = 10;
const HEATMAP_COLS = 13;
const PERSIST_INTERVAL_FRAMES = 900; // ~30s at 30fps

// Goal mouth centre coordinates (pitch-normalised)
const HOME_GOAL: [number, number] = [0, 50];
const AWAY_GOAL: [number, number] = [100, 50];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LivePlayerState {
  trackId: number;
  class: string;
  x: number;
  y: number;
  speed: number;
  jerseyNumber?: number;
  /** Accumulated distance this half in metres (pitch = 105m × 68m) */
  distanceM: number;
  /** Number of sprints (speed > 25 km/h) */
  sprints: number;
  /** Previous position for distance calculation */
  prevX: number;
  prevY: number;
}

export interface LiveMatchState {
  matchId: string;
  frameNumber: number;
  matchClock: number;
  half: number;
  players: LivePlayerState[];
  ball: { x: number; y: number; speed: number } | null;
  /** Cumulative possession frames: home / away */
  possessionFrames: { home: number; away: number };
  /** Heatmap accumulator grids [row][col] */
  heatmaps: { home: number[][]; away: number[][] };
  /** Cumulative xG */
  xg: { home: number; away: number };
  /** xG timeline snapshots (one per minute) */
  xgTimeline: { home: number[]; away: number[] };
  /** Detected events this match */
  events: DetectedEvent[];
  /** Last time analytics were persisted to DB */
  lastPersistFrame: number;
  /** Detected formations */
  formations: { home: string; away: string };
}

export interface DetectedEvent {
  frameNumber: number;
  matchClock: number;
  minute: number;
  type: string;
  team: 'home' | 'away' | null;
  trackId?: number;
  jerseyNumber?: number;
  xg?: number;
  metadata?: Record<string, unknown>;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class VisionIngestService {
  private readonly logger = new Logger(VisionIngestService.name);

  /** In-memory live state per matchId */
  private readonly states = new Map<string, LiveMatchState>();

  /** Callbacks registered by SportsGateway to push frames to WebSocket clients */
  private readonly frameListeners: Array<(matchId: string, state: LiveMatchState) => void> = [];

  constructor(
    @InjectRepository(MatchAnalytics)
    private readonly analyticsRepo: Repository<MatchAnalytics>,
    @InjectRepository(MatchEvent)
    private readonly eventsRepo: Repository<MatchEvent>,
    @InjectRepository(SportsMatch)
    private readonly matchesRepo: Repository<SportsMatch>,
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  onFrame(cb: (matchId: string, state: LiveMatchState) => void) {
    this.frameListeners.push(cb);
  }

  getLiveState(matchId: string): LiveMatchState | null {
    return this.states.get(matchId) ?? null;
  }

  getActiveMatches(): Array<{ matchId: string; clock: number; half: number }> {
    return [...this.states.values()].map((s) => ({
      matchId: s.matchId,
      clock: s.matchClock,
      half: s.half,
    }));
  }

  // ── Frame ingestion ────────────────────────────────────────────────────────

  async ingestFrame(matchId: string, dto: IngestFrameDto): Promise<{ ok: boolean }> {
    let state = this.states.get(matchId);
    if (!state) {
      state = this.initState(matchId);
      this.states.set(matchId, state);
      this.logger.log(`Vision tracking started for match ${matchId}`);
    }

    // Update frame metadata
    state.frameNumber = dto.frameNumber;
    state.matchClock = dto.matchClock;
    state.half = dto.half;

    // Separate objects by class
    const homePlayers = dto.objects.filter((o) => o.class === 'player_home' || o.class === 'goalkeeper_home');
    const awayPlayers = dto.objects.filter((o) => o.class === 'player_away' || o.class === 'goalkeeper_away');
    const ball = dto.objects.find((o) => o.class === 'ball');

    // Update player states
    this.updatePlayers(state, homePlayers, 'home');
    this.updatePlayers(state, awayPlayers, 'away');

    // Update ball
    state.ball = ball ? { x: ball.x, y: ball.y, speed: ball.speed ?? 0 } : state.ball;

    // Accumulate possession (ball proximity)
    this.updatePossession(state, ball, homePlayers, awayPlayers);

    // Accumulate heatmaps
    this.updateHeatmaps(state, homePlayers, awayPlayers);

    // Detect events from the pipeline's event field
    if (dto.event) {
      await this.processEvent(state, dto.event, matchId);
    }

    // Update xG timeline (once per minute of match clock)
    const minute = Math.floor(dto.matchClock / 60);
    if (minute >= state.xgTimeline.home.length) {
      state.xgTimeline.home.push(state.xg.home);
      state.xgTimeline.away.push(state.xg.away);
    }

    // Detect formation from player positions
    state.formations = {
      home: this.detectFormation(homePlayers),
      away: this.detectFormation(awayPlayers),
    };

    // Persist to DB every PERSIST_INTERVAL_FRAMES frames
    if (dto.frameNumber - state.lastPersistFrame >= PERSIST_INTERVAL_FRAMES) {
      await this.persistAnalytics(state, matchId);
      state.lastPersistFrame = dto.frameNumber;
    }

    // Notify WebSocket listeners
    this.frameListeners.forEach((cb) => cb(matchId, state!));

    return { ok: true };
  }

  // ── Possession ─────────────────────────────────────────────────────────────

  private updatePossession(
    state: LiveMatchState,
    ball: TrackedObject | undefined,
    home: TrackedObject[],
    away: TrackedObject[],
  ) {
    if (!ball) return;
    const POSSESSION_RADIUS = 3; // pitch units (~3m)

    const nearestHome = home.reduce((min, p) => {
      const d = Math.hypot(p.x - ball.x, p.y - ball.y);
      return d < min ? d : min;
    }, Infinity);

    const nearestAway = away.reduce((min, p) => {
      const d = Math.hypot(p.x - ball.x, p.y - ball.y);
      return d < min ? d : min;
    }, Infinity);

    if (nearestHome < POSSESSION_RADIUS && nearestHome < nearestAway) {
      state.possessionFrames.home++;
    } else if (nearestAway < POSSESSION_RADIUS && nearestAway < nearestHome) {
      state.possessionFrames.away++;
    }
  }

  // ── Heatmaps ───────────────────────────────────────────────────────────────

  private updateHeatmaps(state: LiveMatchState, home: TrackedObject[], away: TrackedObject[]) {
    for (const p of home) {
      const row = Math.min(HEATMAP_ROWS - 1, Math.floor((p.y / 100) * HEATMAP_ROWS));
      const col = Math.min(HEATMAP_COLS - 1, Math.floor((p.x / 100) * HEATMAP_COLS));
      state.heatmaps.home[row][col]++;
    }
    for (const p of away) {
      const row = Math.min(HEATMAP_ROWS - 1, Math.floor((p.y / 100) * HEATMAP_ROWS));
      const col = Math.min(HEATMAP_COLS - 1, Math.floor((p.x / 100) * HEATMAP_COLS));
      state.heatmaps.away[row][col]++;
    }
  }

  // ── Player state updates ───────────────────────────────────────────────────

  private updatePlayers(state: LiveMatchState, objects: TrackedObject[], team: 'home' | 'away') {
    for (const obj of objects) {
      const existing = state.players.find((p) => p.trackId === obj.trackId);
      if (existing) {
        // Accumulate distance (pitch = 105m wide × 68m tall)
        const dx = (obj.x - existing.prevX) * 1.05;
        const dy = (obj.y - existing.prevY) * 0.68;
        existing.distanceM += Math.hypot(dx, dy);
        if ((obj.speed ?? 0) > 25) existing.sprints++;
        existing.x = obj.x;
        existing.y = obj.y;
        existing.speed = obj.speed ?? 0;
        existing.prevX = obj.x;
        existing.prevY = obj.y;
        if (obj.jerseyNumber !== undefined) existing.jerseyNumber = obj.jerseyNumber;
      } else {
        state.players.push({
          trackId: obj.trackId,
          class: `player_${team}`,
          x: obj.x, y: obj.y,
          speed: obj.speed ?? 0,
          jerseyNumber: obj.jerseyNumber,
          distanceM: 0, sprints: 0,
          prevX: obj.x, prevY: obj.y,
        });
      }
    }
  }

  // ── xG model ──────────────────────────────────────────────────────────────

  /**
   * Logistic xG model based on shot distance and angle.
   * Coefficients derived from open StatsBomb data.
   * xG = 1 / (1 + exp(-(b0 + b1*distance + b2*angle)))
   */
  computeXg(shooterX: number, shooterY: number, attackingRight: boolean): number {
    const goalX = attackingRight ? AWAY_GOAL[0] : HOME_GOAL[0];
    const goalY = attackingRight ? AWAY_GOAL[1] : HOME_GOAL[1];

    // Distance in pitch units (0–100 scale, ~105m wide)
    const distRaw = Math.hypot(shooterX - goalX, shooterY - goalY);
    const distM = distRaw * 1.05; // convert to metres

    // Angle to goal (radians) — wider angle = better chance
    const postTop: [number, number] = [goalX, goalY - 3.66]; // 7.32m wide goal
    const postBot: [number, number] = [goalX, goalY + 3.66];
    const a1 = Math.atan2(postTop[1] - shooterY, postTop[0] - shooterX);
    const a2 = Math.atan2(postBot[1] - shooterY, postBot[0] - shooterX);
    const angleDeg = Math.abs((a2 - a1) * (180 / Math.PI));

    // Logistic model
    const b0 = 0.2;
    const b1 = -0.05;
    const b2 = 0.04;
    const z = b0 + b1 * distM + b2 * angleDeg;
    return Math.max(0.01, Math.min(0.99, 1 / (1 + Math.exp(-z))));
  }

  // ── Event processing ───────────────────────────────────────────────────────

  private async processEvent(
    state: LiveMatchState,
    event: Record<string, unknown>,
    matchId: string,
  ) {
    const type = String(event['type'] ?? '');
    const team = (event['team'] as 'home' | 'away' | null) ?? null;
    const trackId = event['trackId'] as number | undefined;
    const minute = Math.floor(state.matchClock / 60);

    const detected: DetectedEvent = {
      frameNumber: state.frameNumber,
      matchClock: state.matchClock,
      minute,
      type,
      team,
      trackId,
      metadata: event as Record<string, unknown>,
    };

    // Compute xG for shots
    if ((type === 'SHOT' || type === 'GOAL') && state.ball) {
      const attackingRight = team === 'home';
      detected.xg = this.computeXg(state.ball.x, state.ball.y, attackingRight);
      if (team === 'home') state.xg.home += detected.xg;
      else if (team === 'away') state.xg.away += detected.xg;
    }

    state.events.push(detected);

    // Persist significant events to DB immediately
    const persistTypes = ['GOAL', 'YELLOW_CARD', 'RED_CARD', 'PENALTY', 'OFFSIDE', 'SUBSTITUTION', 'VAR'];
    if (persistTypes.includes(type)) {
      try {
        // Find the match to get ownerId
        const match = await this.matchesRepo.findOne({ where: { id: matchId } });
        if (match) {
          await this.eventsRepo.save(
            this.eventsRepo.create({
              ownerId: match.ownerId,
              matchId,
              type,
              minute,
              team: team ?? undefined,
              description: String(event['description'] ?? ''),
              metadata: event,
            }),
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to persist event ${type}: ${(err as Error).message}`);
      }
    }
  }

  // ── Formation detection ────────────────────────────────────────────────────

  /**
   * Infer formation from outfield player Y positions.
   * Groups players into defensive / midfield / attacking thirds by X position.
   */
  private detectFormation(players: TrackedObject[]): string {
    const outfield = players.filter((p) => p.class !== 'goalkeeper_home' && p.class !== 'goalkeeper_away');
    if (outfield.length < 8) return '?';

    // Sort by X (depth on pitch)
    const sorted = [...outfield].sort((a, b) => a.x - b.x);
    const third = Math.floor(sorted.length / 3);
    const def = sorted.slice(0, third).length;
    const mid = sorted.slice(third, third * 2).length;
    const att = sorted.slice(third * 2).length;

    return `${def}-${mid}-${att}`;
  }

  // ── DB persistence ─────────────────────────────────────────────────────────

  private async persistAnalytics(state: LiveMatchState, matchId: string): Promise<void> {
    try {
      const match = await this.matchesRepo.findOne({ where: { id: matchId } });
      if (!match) return;

      const total = state.possessionFrames.home + state.possessionFrames.away || 1;
      const possession = {
        home: Math.round((state.possessionFrames.home / total) * 100),
        away: Math.round((state.possessionFrames.away / total) * 100),
      };

      // Normalise heatmaps to 0–100 scale
      const normalise = (grid: number[][]) => {
        const max = Math.max(...grid.flat(), 1);
        return grid.map((row) => row.map((v) => Math.round((v / max) * 100)));
      };

      const existing = await this.analyticsRepo.findOne({ where: { matchId, ownerId: match.ownerId } });

      const data: Partial<MatchAnalytics> = {
        ownerId: match.ownerId,
        matchId,
        status: 'PROCESSING',
        possession: possession as unknown as Record<string, unknown>,
        heatmaps: { home: normalise(state.heatmaps.home), away: normalise(state.heatmaps.away) } as unknown as Record<string, unknown>,
        xgData: { home: [...state.xgTimeline.home], away: [...state.xgTimeline.away] } as unknown as Record<string, unknown>,
        formations: state.formations as unknown as Record<string, unknown>,
        playerTracking: {
          players: state.players.map((p) => ({
            trackId: p.trackId,
            class: p.class,
            x: p.x, y: p.y,
            speed: p.speed,
            jerseyNumber: p.jerseyNumber,
            distanceKm: parseFloat((p.distanceM / 1000).toFixed(2)),
            sprints: p.sprints,
          })),
          ball: state.ball,
          frameNumber: state.frameNumber,
          matchClock: state.matchClock,
        } as unknown as Record<string, unknown>,
      };

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.analyticsRepo.update(existing.id, data as any);
      } else {
        await this.analyticsRepo.save(this.analyticsRepo.create(data));
      }
    } catch (err) {
      this.logger.warn(`Analytics persist failed for ${matchId}: ${(err as Error).message}`);
    }
  }

  // ── State initialisation ───────────────────────────────────────────────────

  private initState(matchId: string): LiveMatchState {
    return {
      matchId,
      frameNumber: 0,
      matchClock: 0,
      half: 1,
      players: [],
      ball: null,
      possessionFrames: { home: 0, away: 0 },
      heatmaps: {
        home: Array.from({ length: HEATMAP_ROWS }, () => new Array(HEATMAP_COLS).fill(0)),
        away: Array.from({ length: HEATMAP_ROWS }, () => new Array(HEATMAP_COLS).fill(0)),
      },
      xg: { home: 0, away: 0 },
      xgTimeline: { home: [0], away: [0] },
      events: [],
      lastPersistFrame: 0,
      formations: { home: '?', away: '?' },
    };
  }
}
