import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Durable per-owner memory for Kobe AI — a small set of facts/preferences the
 * assistant remembers across sessions and applies to future answers (e.g.
 * "replies in Swahili", "main supplier is Acme", "VAT is 18%"). Separate from
 * the per-session chat history the client passes in.
 */
@Entity('ai_memory')
export class AiMemory extends BaseEntity {
  @Index({ unique: true })
  @Column('uuid')
  ownerId!: string;

  @Column({ type: 'jsonb', default: [] })
  facts!: string[];
}
