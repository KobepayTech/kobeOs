import { Entity, Column, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * One embedded document for semantic search. `vector` is the embedding of
 * `text` (produced by the local Ollama embed model). Similarity is computed in
 * the app (cosine) — fine for a shop's data volume, and avoids needing the
 * pgvector extension in the embedded database.
 */
@Entity('search_docs')
@Index(['ownerId', 'kind', 'refId'], { unique: true })
export class SearchDoc extends OwnedEntity {
  /** product | tenant | review — the source record type. */
  @Column()
  kind!: string;

  @Column('uuid')
  refId!: string;

  @Column({ type: 'text', default: '' })
  text!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  vector!: number[];

  /** Embed model used, so a model change can trigger a re-index. */
  @Column({ default: '' })
  model!: string;
}
