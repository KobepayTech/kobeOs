import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * A document the owner uploaded for Kobe to "chat with" — a contract, a price
 * list, a supplier catalogue, a policy PDF. The raw text is split into
 * `AiDocChunk`s that are embedded for retrieval; this row is the parent the UI
 * lists and the user deletes.
 */
@Entity('ai_documents')
export class AiDocument extends OwnedEntity {
  @Column({ default: '' })
  title!: string;

  /** Where it came from: filename, "pasted", etc. Informational only. */
  @Column({ default: '' })
  source!: string;

  @Column({ type: 'int', default: 0 })
  chunkCount!: number;

  @Column({ type: 'int', default: 0 })
  charCount!: number;
}

/**
 * One embedded passage of an AiDocument. Similarity is cosine in the app (same
 * approach as SearchDoc), so we don't need pgvector in the embedded database.
 */
@Entity('ai_doc_chunks')
@Index(['ownerId', 'documentId'])
export class AiDocChunk extends OwnedEntity {
  @Column('uuid')
  documentId!: string;

  /** Document title, denormalised so a retrieved passage can cite its source. */
  @Column({ default: '' })
  title!: string;

  @Column({ type: 'int', default: 0 })
  idx!: number;

  @Column({ type: 'text', default: '' })
  text!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  vector!: number[];

  @Column({ default: '' })
  model!: string;
}
