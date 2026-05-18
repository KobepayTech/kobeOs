/**
 * OffsideDetectionService
 *
 * VAR-style offside detection using player positions from the vision pipeline.
 *
 * Algorithm:
 *  1. Identify the attacker to check (by trackId)
 *  2. Find the second-to-last defender on the defending team
 *     (the last defender is usually the goalkeeper)
 *  3. The offside line = the X coordinate of that second-to-last defender
 *  4. The attacker is offside if their X (body, not feet) is beyond the line
 *     at the moment the ball is played
 *  5. Return the verdict + line coordinates for rendering on the pitch
 *
 * Coordinate system (pitch-normalised, same as VisionIngestService):
 *   X: 0 = left goal line → 100 = right goal line
 *   Y: 0 = top touchline  → 100 = bottom touchline
 */

import { Injectable, Logger } from '@nestjs/common';
import type { CheckOffsideDto, TrackedObject } from './dto/sports.dto';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OffsideResult {
  verdict: 'OFFSIDE' | 'ONSIDE' | 'INCONCLUSIVE';
  frameNumber: number;
  matchClock: number;
  minuteStr: string;

  /** The attacker being checked */
  attacker: { trackId: number; x: number; y: number; jerseyNumber?: number };

  /** The second-to-last defender that defines the offside line */
  lastDefender: { trackId: number; x: number; y: number } | null;

  /**
   * The offside line X coordinate (pitch-normalised).
   * Draw a vertical line at this X on the pitch SVG.
   */
  offsideLineX: number | null;

  /** Gap in pitch units (positive = attacker is offside by this much) */
  marginX: number | null;

  /** All defender positions at this frame (for rendering) */
  defenderLine: Array<{ trackId: number; x: number; y: number }>;

  timestamp: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class OffsideDetectionService {
  private readonly logger = new Logger(OffsideDetectionService.name);

  /** In-memory store of offside events per match */
  private readonly events = new Map<string, OffsideResult[]>();

  check(matchId: string, dto: CheckOffsideDto): OffsideResult {
    const attackingRight = dto.attackDirection === 'left_to_right';

    // Separate teams
    const attackers = dto.objects.filter((o) =>
      attackingRight
        ? o.class === 'player_home' || o.class === 'goalkeeper_home'
        : o.class === 'player_away' || o.class === 'goalkeeper_away',
    );
    const defenders = dto.objects.filter((o) =>
      attackingRight
        ? o.class === 'player_away' || o.class === 'goalkeeper_away'
        : o.class === 'player_home' || o.class === 'goalkeeper_home',
    );

    const attacker = dto.objects.find((o) => o.trackId === dto.attackerTrackId);
    if (!attacker) {
      return this.inconclusiveResult(dto, 'Attacker track ID not found in frame');
    }

    if (defenders.length < 2) {
      return this.inconclusiveResult(dto, 'Fewer than 2 defenders detected');
    }

    // Sort defenders by X: when attacking right, the last defenders are
    // those with the smallest X (closest to their own goal).
    // When attacking left, the last defenders have the largest X.
    const sortedDefs = [...defenders].sort((a, b) =>
      attackingRight ? a.x - b.x : b.x - a.x,
    );

    // Second-to-last defender (index 1 after sorting toward own goal)
    const secondToLast = sortedDefs[1];
    const offsideLineX = secondToLast.x;

    // Check: attacker is offside if they are beyond the offside line
    // (closer to the opponent's goal than the second-to-last defender)
    const attackerBeyond = attackingRight
      ? attacker.x > offsideLineX
      : attacker.x < offsideLineX;

    // Also must be in the opponent's half
    const inOpponentHalf = attackingRight ? attacker.x > 50 : attacker.x < 50;

    const marginX = attackingRight
      ? attacker.x - offsideLineX
      : offsideLineX - attacker.x;

    const verdict: OffsideResult['verdict'] =
      attackerBeyond && inOpponentHalf ? 'OFFSIDE' : 'ONSIDE';

    const minute = Math.floor(dto.matchClock / 60);
    const seconds = Math.floor(dto.matchClock % 60);
    const minuteStr = `${minute}:${String(seconds).padStart(2, '0')}`;

    const result: OffsideResult = {
      verdict,
      frameNumber: dto.frameNumber,
      matchClock: dto.matchClock,
      minuteStr,
      attacker: {
        trackId: attacker.trackId,
        x: attacker.x,
        y: attacker.y,
        jerseyNumber: attacker.jerseyNumber,
      },
      lastDefender: {
        trackId: secondToLast.trackId,
        x: secondToLast.x,
        y: secondToLast.y,
      },
      offsideLineX,
      marginX: parseFloat(marginX.toFixed(2)),
      defenderLine: sortedDefs.map((d) => ({ trackId: d.trackId, x: d.x, y: d.y })),
      timestamp: new Date().toISOString(),
    };

    // Store event
    if (!this.events.has(matchId)) this.events.set(matchId, []);
    this.events.get(matchId)!.push(result);

    this.logger.log(
      `Offside check [${matchId}] ${minuteStr} — ${verdict} (margin: ${marginX.toFixed(2)} units)`,
    );

    return result;
  }

  getEvents(matchId: string): OffsideResult[] {
    return this.events.get(matchId) ?? [];
  }

  clearEvents(matchId: string): void {
    this.events.delete(matchId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private inconclusiveResult(dto: CheckOffsideDto, reason: string): OffsideResult {
    this.logger.warn(`Offside inconclusive: ${reason}`);
    const minute = Math.floor(dto.matchClock / 60);
    const seconds = Math.floor(dto.matchClock % 60);
    return {
      verdict: 'INCONCLUSIVE',
      frameNumber: dto.frameNumber,
      matchClock: dto.matchClock,
      minuteStr: `${minute}:${String(seconds).padStart(2, '0')}`,
      attacker: { trackId: dto.attackerTrackId, x: 0, y: 0 },
      lastDefender: null,
      offsideLineX: null,
      marginX: null,
      defenderLine: [],
      timestamp: new Date().toISOString(),
    };
  }
}
