import { api, apiArray } from './api';

export interface ChatThread {
  id: string;
  title: string;
  appId: string;
  lastMessageAt: string | null;
  messageCount: number;
  archivedAt: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  model: string;
  provider: string;
  createdAt: string;
}

/**
 * Conversations are stored server-side, so every one of these can fail when
 * the shop is offline. Each returns an empty/neutral value rather than
 * throwing: losing the history sidebar must never stop someone asking a
 * question.
 */
export async function listChatThreads(includeArchived = false): Promise<ChatThread[]> {
  try {
    return await apiArray<ChatThread>(`/ai/chat/threads${includeArchived ? '?archived=true' : ''}`);
  } catch {
    return [];
  }
}

export async function loadChatThread(
  id: string,
): Promise<{ thread: ChatThread; messages: ChatMessage[] } | null> {
  try {
    return await api<{ thread: ChatThread; messages: ChatMessage[] }>(`/ai/chat/threads/${id}`);
  } catch {
    return null;
  }
}

export async function renameChatThread(id: string, title: string): Promise<ChatThread | null> {
  try {
    return await api<ChatThread>(`/ai/chat/threads/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
      offlineFallback: false,
    });
  } catch {
    return null;
  }
}

export async function archiveChatThread(id: string, archived = true): Promise<boolean> {
  try {
    await api(`/ai/chat/threads/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archived }),
      offlineFallback: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteChatThread(id: string): Promise<boolean> {
  try {
    await api(`/ai/chat/threads/${id}`, { method: 'DELETE', offlineFallback: false });
    return true;
  } catch {
    return false;
  }
}

/** "3 min ago" style label for the thread list. */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}
