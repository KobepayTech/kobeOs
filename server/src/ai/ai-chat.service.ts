import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatMessage, AiChatRole, AiChatThread } from './ai-chat.entity';

/** Longest a derived title gets before it is cut at a word boundary. */
const TITLE_MAX = 60;
/** How many past turns are replayed into a new request by default. */
export const DEFAULT_HISTORY_TURNS = 20;

/**
 * Turn the opening message into something recognisable in a thread list.
 * Cutting mid-word reads as broken, so trim back to the last space when the
 * message is long enough for that to be possible.
 */
export function deriveTitle(message: string): string {
  const clean = (message ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New conversation';
  if (clean.length <= TITLE_MAX) return clean;
  const cut = clean.slice(0, TITLE_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

@Injectable()
export class AiChatService {
  constructor(
    @InjectRepository(AiChatThread) private readonly threads: Repository<AiChatThread>,
    @InjectRepository(AiChatMessage) private readonly messages: Repository<AiChatMessage>,
  ) {}

  /**
   * Resolve the thread a turn belongs to, creating one when the caller has no
   * id yet. An id that is not this owner's is rejected rather than silently
   * starting a new thread, so a bug cannot scatter a conversation.
   */
  async openThread(ownerId: string, threadId: string | undefined, firstMessage: string, appId = ''): Promise<AiChatThread> {
    if (threadId) return this.mustOwn(ownerId, threadId);
    return this.threads.save(this.threads.create({
      ownerId,
      title: deriveTitle(firstMessage),
      appId,
      messageCount: 0,
    }));
  }

  async append(
    ownerId: string,
    threadId: string,
    role: AiChatRole,
    content: string,
    meta: { model?: string; provider?: string; promptTokens?: number; completionTokens?: number } = {},
  ): Promise<AiChatMessage> {
    const saved = await this.messages.save(this.messages.create({
      ownerId,
      threadId,
      role,
      content,
      model: meta.model ?? '',
      provider: meta.provider ?? '',
      promptTokens: meta.promptTokens ?? 0,
      completionTokens: meta.completionTokens ?? 0,
    }));
    // Counter and timestamp are maintained here so the thread list needs no
    // aggregate over messages.
    await this.threads.increment({ id: threadId, ownerId }, 'messageCount', 1);
    await this.threads.update({ id: threadId, ownerId }, { lastMessageAt: saved.createdAt });
    return saved;
  }

  /** Past turns for a thread, oldest first, ready to prepend to a request. */
  async history(ownerId: string, threadId: string, turns = DEFAULT_HISTORY_TURNS): Promise<Array<{ role: AiChatRole; content: string }>> {
    const rows = await this.messages.find({
      where: { ownerId, threadId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: Math.max(1, turns) * 2,
    });
    return rows.reverse().map((row) => ({ role: row.role, content: row.content }));
  }

  listThreads(ownerId: string, includeArchived = false): Promise<AiChatThread[]> {
    const qb = this.threads.createQueryBuilder('t')
      .where('t."ownerId" = :ownerId', { ownerId })
      .orderBy('t."lastMessageAt"', 'DESC', 'NULLS LAST')
      .addOrderBy('t."createdAt"', 'DESC')
      .take(200);
    if (!includeArchived) qb.andWhere('t."archivedAt" IS NULL');
    return qb.getMany();
  }

  async thread(ownerId: string, threadId: string): Promise<{ thread: AiChatThread; messages: AiChatMessage[] }> {
    const thread = await this.mustOwn(ownerId, threadId);
    const messages = await this.messages.find({
      where: { ownerId, threadId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return { thread, messages };
  }

  async rename(ownerId: string, threadId: string, title: string): Promise<AiChatThread> {
    const thread = await this.mustOwn(ownerId, threadId);
    thread.title = deriveTitle(title);
    return this.threads.save(thread);
  }

  async archive(ownerId: string, threadId: string, archived: boolean): Promise<AiChatThread> {
    const thread = await this.mustOwn(ownerId, threadId);
    thread.archivedAt = archived ? (thread.archivedAt ?? new Date()) : null;
    return this.threads.save(thread);
  }

  async remove(ownerId: string, threadId: string): Promise<{ deleted: true }> {
    await this.mustOwn(ownerId, threadId);
    // Messages are removed explicitly: there is no FK cascade, and orphaned
    // rows would keep counting against the owner's data forever.
    await this.messages.delete({ ownerId, threadId });
    await this.threads.delete({ id: threadId, ownerId });
    return { deleted: true };
  }

  private async mustOwn(ownerId: string, threadId: string): Promise<AiChatThread> {
    const thread = await this.threads.findOne({ where: { id: threadId, ownerId } });
    if (!thread) throw new NotFoundException('Conversation not found');
    return thread;
  }
}
