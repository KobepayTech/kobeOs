import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Boxing — the combat-sport module plugged into the same sports engine as
 * football. Shares the platform spine (accounts, AI, the broadcast overlay,
 * notifications) but has its own data model: fighters (record + weight class)
 * and bouts (fight cards) scored round-by-round on judges' scorecards.
 */
@Entity('boxing_fighters')
@Index(['ownerId', 'name'])
export class BoxingFighter extends OwnedEntity {
  @Column() name!: string;
  @Column({ default: '' }) nickname!: string;
  @Column({ default: '' }) weightClass!: string;      // e.g. 'Lightweight'
  @Column({ default: 'orthodox' }) stance!: string;    // orthodox | southpaw
  @Column({ default: '' }) country!: string;
  @Column({ type: 'int', nullable: true }) reachCm?: number | null;
  @Column({ type: 'int', nullable: true }) heightCm?: number | null;

  /* Record */
  @Column({ default: 0 }) wins!: number;
  @Column({ default: 0 }) losses!: number;
  @Column({ default: 0 }) draws!: number;
  @Column({ default: 0 }) kos!: number;                // wins by KO/TKO

  @Column({ type: 'int', nullable: true }) ranking?: number | null;
  @Column({ default: '' }) avatarUrl!: string;
}

export type BoutStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED';
export type BoutCard = 'MAIN' | 'CO_MAIN' | 'UNDERCARD';
export type BoutMethod = '' | 'KO' | 'TKO' | 'UD' | 'SD' | 'MD' | 'DRAW' | 'DQ' | 'NC' | 'RTD';

export interface RoundScore { round: number; judge: string; a: number; b: number }

@Entity('boxing_bouts')
@Index(['ownerId', 'status'])
export class BoxingBout extends OwnedEntity {
  @Column({ default: '' }) eventName!: string;         // "Fight Night 12"
  @Column({ type: 'timestamptz', nullable: true }) date?: Date | null;
  @Column({ default: '' }) venue!: string;

  /* Fighters (snapshot names for display + ids for linking) */
  @Index() @Column('uuid') fighterAId!: string;
  @Column() fighterAName!: string;
  @Index() @Column('uuid') fighterBId!: string;
  @Column() fighterBName!: string;

  @Column({ default: '' }) weightClass!: string;
  @Column({ default: '' }) title!: string;             // belt on the line, if any
  @Column({ default: 12 }) scheduledRounds!: number;
  @Column({ default: 'UNDERCARD' }) cardPosition!: BoutCard;

  @Column({ default: 'SCHEDULED' }) status!: BoutStatus;
  @Column({ default: 0 }) currentRound!: number;

  /** Judges scoring this bout (default three). */
  @Column({ type: 'simple-array', default: 'Judge 1,Judge 2,Judge 3' })
  judges!: string[];

  /** Per-round, per-judge scores (typically 10-9 / 10-8). */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  roundScores!: RoundScore[];

  /* Result */
  @Column({ default: '' }) method!: BoutMethod;
  @Column('uuid', { nullable: true }) winnerId?: string | null;
  @Column({ type: 'int', nullable: true }) endRound?: number | null;
  @Column({ type: 'text', default: '' }) aiSummary!: string;
}
