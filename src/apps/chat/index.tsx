import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hash, MessageSquare, Send, Smile, Users, Download,
  ChevronRight, X, Search, User, UserPlus
} from 'lucide-react';

interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  avatarColor: string;
  text: string;
  timestamp: number;
  type: 'message' | 'system';
}

interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  unread: number;
}

interface OnlineUser {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'away';
  avatarColor: string;
}

const STORAGE_KEY = 'kobe_chat_messages';

const DEMO_USERS: OnlineUser[] = [
  { id: 'u1', name: 'Alex Chen', status: 'online', avatarColor: '#ef4444' },
  { id: 'u2', name: 'Jordan Lee', status: 'online', avatarColor: '#f59e0b' },
  { id: 'u3', name: 'Taylor Kim', status: 'away', avatarColor: '#10b981' },
  { id: 'u4', name: 'Morgan Wu', status: 'offline', avatarColor: '#8b5cf6' },
  { id: 'u5', name: 'Riley Park', status: 'online', avatarColor: '#ec4899' },
  { id: 'u6', name: 'Casey Brown', status: 'online', avatarColor: '#06b6d4' },
];

const CHANNELS: Channel[] = [
  { id: 'general', name: 'general', type: 'channel', unread: 0 },
  { id: 'dev', name: 'dev', type: 'channel', unread: 0 },
  { id: 'random', name: 'random', type: 'channel', unread: 0 },
  { id: 'support', name: 'support', type: 'channel', unread: 0 },
];

const DM_CHANNELS: Channel[] = [
  { id: 'dm_alex', name: 'Alex Chen', type: 'dm', unread: 0 },
  { id: 'dm_jordan', name: 'Jordan Lee', type: 'dm', unread: 0 },
  { id: 'dm_taylor', name: 'Taylor Kim', type: 'dm', unread: 0 },
];

const DEMO_MESSAGES: ChatMessage[] = [
  { id: 'm1', channelId: 'general', userId: 'u1', userName: 'Alex Chen', avatarColor: '#ef4444', text: 'Hey team, welcome to the new workspace!', timestamp: Date.now() - 3600000 * 5, type: 'message' },
  { id: 'm2', channelId: 'general', userId: 'u2', userName: 'Jordan Lee', avatarColor: '#f59e0b', text: 'Thanks Alex! Looking forward to collaborating here.', timestamp: Date.now() - 3600000 * 4.5, type: 'message' },
  { id: 'm3', channelId: 'general', userId: 'system', userName: 'System', avatarColor: '#64748b', text: 'Taylor Kim joined the channel', timestamp: Date.now() - 3600000 * 4, type: 'system' },
  { id: 'm4', channelId: 'general', userId: 'u3', userName: 'Taylor Kim', avatarColor: '#10b981', text: 'Hello everyone! Excited to be here.', timestamp: Date.now() - 3600000 * 3.8, type: 'message' },
  { id: 'm5', channelId: 'dev', userId: 'u2', userName: 'Jordan Lee', avatarColor: '#f59e0b', text: 'Anyone reviewed the latest PR?', timestamp: Date.now() - 3600000 * 2, type: 'message' },
  { id: 'm6', channelId: 'dev', userId: 'u6', userName: 'Casey Brown', avatarColor: '#06b6d4', text: 'I left some comments on the auth module.', timestamp: Date.now() - 3600000 * 1.5, type: 'message' },
  { id: 'm7', channelId: 'random', userId: 'u5', userName: 'Riley Park', avatarColor: '#ec4899', text: 'Check out this new AI tool I found today!', timestamp: Date.now() - 3600000 * 6, type: 'message' },
  { id: 'm8', channelId: 'support', userId: 'u1', userName: 'Alex Chen', avatarColor: '#ef4444', text: 'Ticket #1024 resolved. Deployed the hotfix.', timestamp: Date.now() - 3600000 * 1, type: 'message' },
  { id: 'm9', channelId: 'dm_alex', userId: 'u1', userName: 'Alex Chen', avatarColor: '#ef4444', text: 'Can we sync up later today?', timestamp: Date.now() - 3600000 * 3, type: 'message' },
  { id: 'm10', channelId: 'dm_jordan', userId: 'u2', userName: 'Jordan Lee', avatarColor: '#f59e0b', text: 'Sent you the design mockups.', timestamp: Date.now() - 3600000 * 7, type: 'message' },
];

const EMOJIS = ['😀','😂','😍','🤔','👍','❤️','🔥','🎉','👀','🙏','💯','✅','🚀','⚡','💡','🐛','🎨','📦','🔒','📝'];

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEMO_MESSAGES;
}

function saveMessages(msgs: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [activeChannel, setActiveChannel] = useState('general');
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [, setLastRead] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChannel]);

  const channelMessages = messages.filter(m => m.channelId === activeChannel);

  const sendMessage = useCallback(() => {
    if (!input.trim()) return;
    const msg: ChatMessage = {
      id: `m_${Date.now()}`,
      channelId: activeChannel,
      userId: 'me',
      userName: 'You',
      avatarColor: '#3b82f6',
      text: input.trim(),
      timestamp: Date.now(),
      type: 'message',
    };
    setMessages(prev => [...prev, msg]);
    setInput('');
    setShowEmoji(false);
  }, [input, activeChannel]);

  const handleChannelSwitch = (id: string) => {
    setActiveChannel(id);
    setUnreadMap(prev => ({ ...prev, [id]: 0 }));
    setLastRead(prev => ({ ...prev, [id]: Date.now() }));
  };

  const addEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
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

  const allChannels = [...CHANNELS, ...DM_CHANNELS];

  const filteredMessages = searchQuery
    ? channelMessages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()) || m.userName.toLowerCase().includes(searchQuery.toLowerCase()))
    : channelMessages;

  const dateDividers = filteredMessages.map((m, i) => {
    const d = formatDate(m.timestamp);
    const prev = i > 0 ? formatDate(filteredMessages[i - 1].timestamp) : '';
    return d !== prev ? d : null;
  });

  return (
    <div className="flex h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-700 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm">Chat</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Channels</div>
            {CHANNELS.map(ch => {
              const unread = unreadMap[ch.id] || 0;
              const isActive = activeChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleChannelSwitch(ch.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    isActive ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <Hash className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1 text-left">{ch.name}</span>
                  {unread > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
                  )}
                  {isActive && <ChevronRight className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Direct Messages</div>
            {DM_CHANNELS.map(ch => {
              const unread = unreadMap[ch.id] || 0;
              const isActive = activeChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleChannelSwitch(ch.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    isActive ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1 text-left">{ch.name}</span>
                  {unread > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-2 border-t border-slate-700">
          <button
            onClick={exportHistory}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export History
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 bg-slate-800/50">
          <div className="flex items-center gap-2">
            {allChannels.find(c => c.id === activeChannel)?.type === 'channel' ? (
              <Hash className="w-4 h-4 text-slate-400" />
            ) : (
              <User className="w-4 h-4 text-slate-400" />
            )}
            <span className="font-semibold text-sm">
              {allChannels.find(c => c.id === activeChannel)?.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
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

        {/* Messages */}
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
            const isMe = msg.userId === 'me';

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
                    style={{ backgroundColor: msg.avatarColor }}
                  >
                    {msg.userName.charAt(0)}
                  </div>
                  <div className={`flex-1 min-w-0 ${isMe ? 'text-right' : ''}`}>
                    <div className={`flex items-baseline gap-2 mb-0.5 ${isMe ? 'justify-end' : ''}`}>
                      <span className="text-sm font-semibold text-slate-200">{msg.userName}</span>
                      <span className="text-[10px] text-slate-500">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className={`text-sm text-slate-300 leading-relaxed whitespace-pre-wrap ${isMe ? 'bg-blue-600/20 px-3 py-1.5 rounded-lg inline-block text-left' : ''}`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-700 bg-slate-800/50 shrink-0">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Message #${allChannels.find(c => c.id === activeChannel)?.name || ''}`}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => setShowEmoji(!showEmoji)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Smile className="w-4 h-4" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg p-2 shadow-xl grid grid-cols-5 gap-1 w-48 z-50">
                  <button onClick={() => setShowEmoji(false)} className="absolute top-1 right-1 text-slate-400 hover:text-slate-200">
                    <X className="w-3 h-3" />
                  </button>
                  <div className="col-span-5 h-4" />
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => addEmoji(emoji)}
                      className="p-1 hover:bg-slate-700 rounded text-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* User List Sidebar */}
      {showUsers && (
        <div className="w-48 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Members</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {DEMO_USERS.map(user => (
              <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700 transition-colors">
                <div className="relative">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${
                    user.status === 'online' ? 'bg-green-500' : user.status === 'away' ? 'bg-yellow-500' : 'bg-slate-500'
                  }`} />
                </div>
                <span className="text-xs text-slate-300 truncate">{user.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
