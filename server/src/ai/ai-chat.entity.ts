import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type AiChatRole = 'user' | 'assistant';

/**
 * A saved assistant conversation.
 *
 * Until now KobeOS stored none of this: the client replayed its own history
 * on every request and the conversation was gone on reload, so the assistant
 * could not be reopened, searched, or audited after the fact.
 *
 * Note these extend BaseEntity and declare ownerId themselves rather than
 * extending OwnedEntity, which adds its own index — two indexes on one column
 * breaks schema synchronisation (see UserOnboarding for the same fix).
 */
@Entity('ai_chat_threads')
export class AiChatThread extends BaseEntity {
  @Index('IDX_ai_chat_threads_owner')
  @Column('uuid')
  ownerId!: string;

  /** Derived from the opening message; the user can rename it. */
  @Column({ default: '' })
  title!: string;

  /** Which KobeOS app the conversation started in, for grouping. */
  @Column({ default: '' })
  appId!: string;

  /** Ordering key for the thread list — cheaper than a join on every list. */
  @Index('IDX_ai_chat_threads_last_message')
  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  messageCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date | null;
}

@Entity('ai_chat_messages')
export class AiChatMessage extends BaseEntity {
  @Index('IDX_ai_chat_messages_owner')
  @Column('uuid')
  ownerId!: string;

  @Index('IDX_ai_chat_messages_thread')
  @Column('uuid')
  threadId!: string;

  @Column({ type: 'varchar', length: 16 })
  role!: AiChatRole;

  @Column('text')
  content!: string;

  /** Which model answered, so a thread shows where its answers came from. */
  @Column({ default: '' })
  model!: string;

  @Column({ default: '' })
  provider!: string;

  @Column({ type: 'int', default: 0 })
  promptTokens!: number;

  @Column({ type: 'int', default: 0 })
  completionTokens!: number;
}
