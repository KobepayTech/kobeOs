import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

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
@Index(['matchId'])
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
