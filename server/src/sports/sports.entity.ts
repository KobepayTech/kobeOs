import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';
import { BaseEntity } from '../common/base.entity';

// ── Match ─────────────────────────────────────────────────────────────────

@Entity('sports_matches')
@Index(['ownerId', 'kickoff'])
export class SportsMatch extends OwnedEntity {
  @Column() sport!: string;           // 'football' | 'basketball' | 'rugby' etc.
  @Column() homeTeam!: string;
  @Column() awayTeam!: string;
  @Column({ type: 'timestamptz' }) kickoff!: Date;
  @Column({ default: 'SCHEDULED' }) status!: string; // SCHEDULED | LIVE | HT | FT | POSTPONED
  @Column({ default: 0 }) homeScore!: number;
  @Column({ default: 0 }) awayScore!: number;
  @Column({ type: 'varchar', nullable: true }) venue?: string;
  @Column({ type: 'varchar', nullable: true }) competition?: string;
  @Column({ type: 'varchar', nullable: true }) season?: string;
  @Column({ type: 'jsonb', nullable: true }) homeLineup?: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) awayLineup?: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) stats?: Record<string, unknown> | null;
  @Column({ type: 'text', nullable: true }) aiReport?: string | null;
  /** Current match minute (updated by vision pipeline) */
  @Column({ type: 'int', nullable: true }) currentMinute?: number | null;
  @Column({ type: 'int', default: 1 }) currentHalf!: number;
  /** Whether the vision pipeline should be posting frames */
  @Column({ default: false }) trackingActive!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) startedAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) endedAt?: Date | null;
}

// ── Match Event ───────────────────────────────────────────────────────────

@Entity('sports_events')
@Index(['matchId', 'minute'])
export class MatchEvent extends OwnedEntity {
  @Index()
  @Column('uuid') matchId!: string;
  @Column() type!: string; // GOAL | YELLOW_CARD | RED_CARD | SUBSTITUTION | OFFSIDE | FOUL | PENALTY | VAR
  @Column() minute!: number;
  @Column({ type: 'varchar', nullable: true }) playerName?: string;
  @Column({ type: 'varchar', nullable: true }) team?: string;
  @Column({ type: 'varchar', nullable: true }) description?: string;
  @Column({ type: 'jsonb', nullable: true }) metadata?: Record<string, unknown> | null;
}

// ── Player ────────────────────────────────────────────────────────────────

@Entity('sports_players')
@Index(['ownerId', 'teamId'])
export class SportsPlayer extends OwnedEntity {
  @Column() name!: string;
  @Column({ type: 'varchar', nullable: true }) teamId?: string;
  @Column({ type: 'varchar', nullable: true }) teamName?: string;
  @Column({ type: 'varchar', nullable: true }) position?: string;  // GK | CB | LB | RB | CDM | CM | CAM | LW | RW | ST
  @Column({ type: 'varchar', nullable: true }) nationality?: string;
  @Column({ type: 'int', nullable: true }) jerseyNumber?: number;
  @Column({ type: 'float', default: 0 }) rating!: number;
  @Column({ type: 'jsonb', nullable: true }) stats?: Record<string, unknown> | null;
  @Column({ type: 'varchar', nullable: true }) avatarUrl?: string;
}

// ── Team ──────────────────────────────────────────────────────────────────

@Entity('sports_teams')
@Index(['ownerId', 'competition'])
export class SportsTeam extends OwnedEntity {
  @Column() name!: string;
  @Column({ type: 'varchar', nullable: true }) shortName?: string;
  @Column({ type: 'varchar', nullable: true }) competition?: string;
  @Column({ type: 'varchar', nullable: true }) logoUrl?: string;
  @Column({ type: 'varchar', nullable: true }) stadium?: string;
  @Column({ type: 'varchar', nullable: true }) country?: string;
  @Column({ default: 0 }) played!: number;
  @Column({ default: 0 }) won!: number;
  @Column({ default: 0 }) drawn!: number;
  @Column({ default: 0 }) lost!: number;
  @Column({ default: 0 }) goalsFor!: number;
  @Column({ default: 0 }) goalsAgainst!: number;
  @Column({ default: 0 }) points!: number;
}

// ── Analytics Session (heatmaps, tracking data) ───────────────────────────

@Entity('sports_analytics')
export class MatchAnalytics extends OwnedEntity {
  @Index()
  @Column('uuid') matchId!: string;
  @Column({ default: 'PENDING' }) status!: string; // PENDING | PROCESSING | COMPLETE | FAILED
  @Column({ type: 'jsonb', nullable: true }) possession?: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) heatmaps?: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) passingNetwork?: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) playerTracking?: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) offsideEvents?: Record<string, unknown>[] | null;
  @Column({ type: 'jsonb', nullable: true }) xgData?: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) formations?: Record<string, unknown> | null;
  @Column({ type: 'text', nullable: true }) aiCommentary?: string | null;
  @Column({ type: 'text', nullable: true }) aiTacticalReport?: string | null;
}

// ── Player Season Stats ───────────────────────────────────────────────────────

@Entity('sports_player_stats')
@Index(['playerId', 'season'])
export class PlayerSeasonStats extends OwnedEntity {
  @Index()
  @Column('uuid') playerId!: string;

  @Column() season!: string; // e.g. '2024/25'

  @Column({ type: 'varchar', nullable: true }) competition?: string;

  @Column({ default: 0 }) matchesPlayed!: number;
  @Column({ default: 0 }) minutesPlayed!: number;
  @Column({ default: 0 }) goals!: number;
  @Column({ default: 0 }) assists!: number;
  @Column({ default: 0 }) yellowCards!: number;
  @Column({ default: 0 }) redCards!: number;

  /** Cumulative xG across all matches */
  @Column({ type: 'decimal', precision: 8, scale: 3, default: 0 }) xgTotal!: number;

  /** Cumulative distance in km */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) distanceKm!: number;

  /** Total sprints (>25 km/h) */
  @Column({ default: 0 }) sprints!: number;

  /** Average match rating (0–100) */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) avgRating!: number;

  /** Per-match breakdown [{matchId, date, rating, goals, assists, distanceKm, sprints}] */
  @Column({ type: 'jsonb', nullable: true }) matchHistory?: Record<string, unknown>[] | null;
}

// ── Camera Session ────────────────────────────────────────────────────────────

export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'STANDBY';
export type CameraRole = 'main' | 'goal_home' | 'goal_away' | 'tactical' | 'drone' | 'referee';

@Entity('sports_cameras')
export class CameraSession extends BaseEntity {
  /** Human-readable label, e.g. "Main Stand Camera 1" */
  @Column() label!: string;

  @Column({ default: 'main' }) role!: CameraRole;

  /** IP address or RTSP stream URL */
  @Column() streamUrl!: string;

  @Column({ default: 'STANDBY' }) status!: CameraStatus;

  /** Current frames per second (updated by heartbeat) */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) fps!: number;

  /** Resolution, e.g. "3840x2160" */
  @Column({ type: 'varchar', nullable: true }) resolution?: string;

  /** Last heartbeat from the Python pipeline */
  @Column({ type: 'timestamptz', nullable: true }) lastHeartbeat?: Date | null;

  /** Match this camera is currently assigned to */
  @Column({ type: 'uuid', nullable: true }) activeMatchId?: string | null;

  /** 3×3 homography matrix (pixel → pitch coords) calibrated for this camera */
  @Column({ type: 'jsonb', nullable: true }) homography?: number[][] | null;

  /** Calibration status */
  @Column({ default: false }) calibrated!: boolean;

  /** Error message if status === 'ERROR' */
  @Column({ type: 'text', nullable: true }) errorMessage?: string | null;
}
