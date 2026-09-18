import { useCallback, useEffect, useState } from 'react';
import { Archive, MessageSquare, Plus, Trash2 } from 'lucide-react';
import {
  ChatThread,
  archiveChatThread,
  deleteChatThread,
  listChatThreads,
  relativeTime,
} from '@/lib/ai-chat';

/**
 * Past conversations, which KobeOS could not show before because it stored
 * none — the assistant replayed the client's own history and lost it on
 * reload.
 */
export default function ConversationHistory({
  activeThreadId,
  onOpen,
  onNew,
  onClose,
}: {
  activeThreadId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setThreads(await listChatThreads());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const drop = async (id: string) => {
    // Optimistic: the row disappears immediately, and a failed delete is
    // corrected by the reload rather than leaving the list frozen.
    setThreads((list) => list.filter((t) => t.id !== id));
    await deleteChatThread(id);
    void load();
  };

  const archive = async (id: string) => {
    setThreads((list) => list.filter((t) => t.id !== id));
    await archiveChatThread(id, true);
    void load();
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a16]">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <div className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">Conversations</div>
        <button
          type="button"
          onClick={onNew}
          title="Start a new conversation"
          className="grid h-6 w-6 place-items-center rounded bg-indigo-600 text-white hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Hide conversations"
          className="rounded px-1.5 py-0.5 text-[11px] text-white/40 hover:text-white/80"
        >
          Hide
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-3 text-[11px] text-white/40">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="px-2 py-3 text-[11px] leading-relaxed text-white/40">
            No saved conversations yet. Ask Kobe something and it will be kept here.
          </p>
        ) : (
          <ul className="space-y-1">
            {threads.map((thread) => (
              <li key={thread.id}>
                <div
                  className={`group flex items-start gap-2 rounded-lg px-2 py-2 ${
                    thread.id === activeThreadId ? 'bg-indigo-600/20 ring-1 ring-indigo-500/40' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(thread.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 shrink-0 text-white/30" />
                      <span className="truncate text-[12px] text-white/85">{thread.title || 'Conversation'}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] text-white/35">
                      {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
                      {thread.lastMessageAt ? ` · ${relativeTime(thread.lastMessageAt)}` : ''}
                    </span>
                  </button>
                  <span className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={`Archive ${thread.title || 'conversation'}`}
                      onClick={() => archive(thread.id)}
                      className="grid h-6 w-6 place-items-center rounded text-white/40 hover:bg-white/10 hover:text-white/80"
                    >
                      <Archive className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${thread.title || 'conversation'}`}
                      onClick={() => drop(thread.id)}
                      className="grid h-6 w-6 place-items-center rounded text-white/40 hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
