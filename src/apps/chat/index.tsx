import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hash, MessageSquare, Send, Smile, Users, Download,
  Search, User, UserPlus
} from 'lucide-react';
import { api } from '@/lib/api';
import { ensureSession, type AuthUser } from '@/lib/auth';

interface ApiChannel {
  id: string;
  slug: string;
  name: string;
  type: 'channel' | 'dm';
  description: string;
}

interface ApiMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  type: 'message' | 'system';
  text: string;
  createdAt: string;
}

interface OnlineUser {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'away';
  avatarColor: string;
}

const DEMO_USERS: OnlineUser[] = [
  { id: 'u1', name: 'Alex Chen', status: 'online', avatarColor: '#ef4444' },
  { id: 'u2', name: 'Jordan Lee', status: 'online', avatarColor: '#f59e0b' },
  { id: 'u3', name: 'Taylor Kim', status: 'away', avatarColor: '#10b981' },
  { id: 'u4', name: 'Morgan Wu', status: 'offline', avatarColor: '#8b5cf6' },
  { id: 'u5', name: 'Riley Park', status: 'online', avatarColor: '#ec4899' },
  { id: 'u6', name: 'Casey Brown', status: 'online', avatarColor: '#06b6d4' },
];

const DEFAULT_CHANNELS: Array<{ slug: string; name: string; type: 'channel' | 'dm' }> = [
  { slug: 'general', name: 'general', type: 'channel' },
  { slug: 'dev', name: 'dev', type: 'channel' },
  { slug: 'random', name: 'random', type: 'channel' },
  { slug: 'support', name: 'support', type: 'channel' },
];

const EMOJIS = ['😀','😂','😍','🤔','👍','❤️','🔥','🎉','👀','🙏','💯','✅','🚀','⚡','💡','🐛','🎨','📦','🔒','📝'];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function colorForId(id: string): string {
  const palette = ['#ef4444','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#3b82f6','#84cc16'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export default function ChatApp() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [channels, setChannels] = useState<ApiChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await ensureSession();
        if (cancelled) return;
        setMe(user);
        let existing = await api<ApiChannel[]>('/chat/channels');
        const have = new Set(existing.map((c) => c.slug));
        const missing = DEFAULT_CHANNELS.filter((c) => !have.has(c.slug));
        if (missing.length) {
          await Promise.all(
            missing.map((c) =>
              api('/chat/channels', { method: 'POST', body: JSON.stringify(c) }),
            ),
          );
          existing = await api<ApiChannel[]>('/chat/channels');
        }
        if (cancelled) return;
        setChannels(existing);
        setActiveChannelId(existing[0]?.id ?? null);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Failed to connect');
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshMessages = useCallback(async (channelId: string) => {
    const list = await api<ApiMessage[]>(`/chat/channels/${channelId}/messages`);
    setMessages(list);
  }, []);

  useEffect(() => {
    if (!activeChannelId) return;
    refreshMessages(activeChannelId).catch((err) => setErrorMsg(err.message));
  }, [activeChannelId, refreshMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChannelId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !activeChannelId) return;
    const text = input.trim();
    setInput('');
    setShowEmoji(false);
    try {
      const msg = await api<ApiMessage>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ channelId: activeChannelId, text }),
      });
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send');
      setInput(text);
    }
  }, [input, activeChannelId]);

  const handleChannelSwitch = (id: string) => {
    setActiveChannelId(id);
    setUnreadMap((prev) => ({ ...prev, [id]: 0 }));
  };

  const addEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const exportHistory = () => {
    const data = JSON.stringify(messages, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-history.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  const filteredMessages = searchQuery
    ? messages.filter(
        (m) =>
          m.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.senderName.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : messages;

  const dateDividers = filteredMessages.map((m, i) => {
    const d = formatDate(m.createdAt);
    const prev = i > 0 ? formatDate(filteredMessages[i - 1].createdAt) : '';
    return d !== prev ? d : null;
  });

  if (status !== 'ready') {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 text-slate-200">
        <div className="text-center px-6">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-500" />
          {status === 'connecting' && <p className="text-sm text-slate-400">Connecting to chat…</p>}
          {status === 'error' && (
            <>
              <p className="text-sm text-red-400">Backend unreachable</p>
              <p className="text-xs text-slate-500 mt-1">{errorMsg}</p>
              <p className="text-xs text-slate-500 mt-2">
                Start the server with <code className="text-slate-300">cd server &amp;&amp; npm run start:dev</code>
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-900 text-slate-100 overflow-hidden">
      <div className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-700 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm">Chat</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Channels</div>
            {channels.filter((c) => c.type === 'channel').map((ch) => {
              const unread = unreadMap[ch.id] || 0;
              const isActive = activeChannelId === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleChannelSwitch(ch.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    isActive ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-left truncate">{ch.name}</span>
                  {unread > 0 && <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{unread}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-2 border-t border-slate-700 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
            {me?.displayName?.[0]?.toUpperCase() ?? 'Y'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{me?.displayName ?? me?.email}</div>
            <div className="text-[10px] text-emerald-400">online</div>
          </div>
          <button onClick={exportHistory} className="p-1.5 rounded hover:bg-slate-700" title="Export history">
            <Download className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-sm">{activeChannel?.name ?? '...'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-slate-900 border border-slate-700 rounded pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-40"
              />
            </div>
            <button
              onClick={() => setShowUsers(!showUsers)}
              className={`p-1.5 rounded transition-colors ${showUsers ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
              title="Toggle user list"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
          {filteredMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
            </div>
          )}
          {filteredMessages.map((msg, idx) => {
            const msgDate = dateDividers[idx];
            const showDateDivider = msgDate !== null;
            const isMe = me?.id === msg.senderId;
            const color = colorForId(msg.senderId);

            if (msg.type === 'system') {
              return (
                <div key={msg.id}>
                  {showDateDivider && (
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-slate-700" />
                      <span className="text-[10px] text-slate-500 font-medium">{msgDate}</span>
                      <div className="flex-1 h-px bg-slate-700" />
                    </div>
                  )}
                  <div className="flex justify-center my-2">
                    <div className="flex items-center gap-1.5 bg-slate-800/80 text-slate-400 text-xs px-3 py-1 rounded-full">
                      <UserPlus className="w-3 h-3" />
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id}>
                {showDateDivider && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-slate-700" />
                    <span className="text-[10px] text-slate-500 font-medium">{msgDate}</span>
                    <div className="flex-1 h-px bg-slate-700" />
                  </div>
                )}
                <div className={`flex gap-3 py-1 px-2 rounded-lg hover:bg-slate-800/50 transition-colors group ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: color }}
                  >
                    {msg.senderName[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className={`flex-1 min-w-0 ${isMe ? 'text-right' : ''}`}>
                    <div className={`flex items-baseline gap-2 ${isMe ? 'justify-end' : ''}`}>
                      <span className="text-sm font-medium" style={{ color }}>{msg.senderName}</span>
                      <span className="text-[10px] text-slate-500">{formatTime(msg.createdAt)}</span>
                    </div>
                    <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">{msg.text}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-700 p-3 shrink-0 relative">
          {showEmoji && (
            <div className="absolute bottom-full left-3 mb-2 bg-slate-800 border border-slate-700 rounded-lg p-2 grid grid-cols-10 gap-1 shadow-xl">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => addEmoji(e)} className="text-lg hover:bg-slate-700 rounded p-1 transition-colors">{e}</button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-slate-800 rounded-lg border border-slate-700 p-2">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Smile className="w-4 h-4" />
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`Message #${activeChannel?.name ?? ''}`}
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-200 placeholder-slate-500 px-1"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="p-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          {errorMsg && <div className="text-xs text-red-400 mt-2">{errorMsg}</div>}
        </div>
      </div>

      {showUsers && (
        <div className="w-56 border-l border-slate-700 bg-slate-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-sm">Members</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {DEMO_USERS.map((u) => (
              <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700">
                <div className="relative">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: u.avatarColor }}
                  >
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div
                    className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-slate-800 ${
                      u.status === 'online' ? 'bg-emerald-400' :
                      u.status === 'away' ? 'bg-amber-400' :
                      'bg-slate-500'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{u.name}</div>
                  <div className="text-[10px] text-slate-500 capitalize">{u.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
