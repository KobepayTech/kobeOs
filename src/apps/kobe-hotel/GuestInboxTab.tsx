import { useMemo, useState } from 'react';
import { Mail, MessageSquare, Phone, Search, Send, Smile, WifiOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Channel = 'whatsapp' | 'email' | 'webchat';

interface Message { from: 'guest' | 'staff'; text: string; at: string }
interface Thread {
  id: string;
  guestName: string;
  room: string;
  channel: Channel;
  lastAt: string;
  unread: number;
  messages: Message[];
}

/**
 * Development-only fixtures keep the visual state easy to exercise locally.
 * Production starts empty until a real guest messaging connector supplies
 * threads, so hotel operators never see invented guest conversations.
 */
const DEMO_THREADS: Thread[] = [
  {
    id: 'dev-1',
    guestName: 'Guest Example',
    room: '#201',
    channel: 'whatsapp',
    lastAt: '2 min ago',
    unread: 1,
    messages: [
      { from: 'guest', text: 'Can we extend checkout to 2pm?', at: '11:24' },
      { from: 'staff', text: 'I will check availability and confirm shortly.', at: '11:26' },
    ],
  },
];
const INITIAL_THREADS = import.meta.env.DEV ? DEMO_THREADS : [];

interface Props { darkMode: boolean }

export default function GuestInboxTab({ darkMode }: Props) {
  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);
  const [activeId, setActiveId] = useState<string>(INITIAL_THREADS[0]?.id ?? '');
  const [filter, setFilter] = useState<'all' | Channel>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');

  const filtered = useMemo(() => threads.filter((thread) => {
    if (filter !== 'all' && thread.channel !== filter) return false;
    if (search && !`${thread.guestName} ${thread.room}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [threads, filter, search]);

  const active = threads.find((thread) => thread.id === activeId) ?? null;
  const unreadTotal = threads.reduce((sum, thread) => sum + thread.unread, 0);

  const selectThread = (id: string) => {
    setThreads((current) => current.map((thread) => thread.id === id ? { ...thread, unread: 0 } : thread));
    setActiveId(id);
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !active) return;
    const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setThreads((current) => current.map((thread) =>
      thread.id === active.id
        ? { ...thread, lastAt: 'just now', messages: [...thread.messages, { from: 'staff', text, at }] }
        : thread,
    ));
    setDraft('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Guest Inbox
            {unreadTotal > 0 && <span className="rounded-md bg-fuchsia-500/20 px-2 py-0.5 text-xs font-extrabold text-fuchsia-500">{unreadTotal} unread</span>}
          </h1>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>WhatsApp, email and web-chat conversations in one place</p>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {(['all', 'whatsapp', 'email', 'webchat'] as const).map((channel) => (
            <Button
              key={channel}
              size="sm"
              variant={filter === channel ? 'default' : 'outline'}
              className={`shrink-0 ${filter === channel ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : darkMode ? 'border-white/10' : ''}`}
              onClick={() => setFilter(channel)}
            >
              {channel === 'all' ? 'All' : labelFor(channel)}
            </Button>
          ))}
        </div>
      </div>

      <div className={`grid min-h-[520px] grid-cols-1 overflow-hidden rounded-2xl border md:h-[600px] md:grid-cols-12 ${darkMode ? 'border-white/[0.06] bg-[#13131f]' : 'border-gray-200 bg-white'}`}>
        <div className={`max-h-64 overflow-y-auto border-b md:col-span-4 md:max-h-none md:border-b-0 md:border-r ${darkMode ? 'border-white/[0.06]' : 'border-gray-200'}`}>
          <div className="sticky top-0 z-10 bg-inherit p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Search guests / rooms…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`pl-8 ${darkMode ? 'border-white/10 bg-[#0a0a1a]' : ''}`}
              />
            </div>
          </div>

          {filtered.length ? (
            <ul>
              {filtered.map((thread) => {
                const isActive = thread.id === active?.id;
                return <li key={thread.id}>
                  <button
                    onClick={() => selectThread(thread.id)}
                    className={`flex w-full items-start gap-2.5 border-b px-3 py-3 text-left ${darkMode ? 'border-white/[0.04]' : 'border-gray-100'} ${isActive ? (darkMode ? 'bg-fuchsia-500/10' : 'bg-fuchsia-50') : darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}
                  >
                    <ChannelDot channel={thread.channel} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{thread.guestName}</span>
                        <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{thread.lastAt}</span>
                      </div>
                      <div className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Room {thread.room} · {labelFor(thread.channel)}</div>
                      <div className={`mt-0.5 truncate text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{thread.messages.at(-1)?.text}</div>
                    </div>
                    {thread.unread > 0 && <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-extrabold text-white">{thread.unread}</span>}
                  </button>
                </li>;
              })}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <MessageSquare className={`mx-auto h-8 w-8 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
              <b className={`mt-3 block text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>No conversations</b>
              <p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{search || filter !== 'all' ? 'Try a different search or channel.' : 'New guest messages will appear here when a messaging channel is connected.'}</p>
            </div>
          )}
        </div>

        <div className="min-h-0 md:col-span-8">
          {active ? (
            <div className="flex h-full min-h-[360px] flex-col">
              <div className={`border-b px-5 py-3 ${darkMode ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">{active.guestName}</h3>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Room {active.room} · {labelFor(active.channel)}</p>
                  </div>
                  <ChannelBadge channel={active.channel} />
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {active.messages.map((message, index) => (
                  <div key={index} className={`flex ${message.from === 'staff' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${message.from === 'staff' ? 'rounded-br-sm bg-fuchsia-600 text-white' : darkMode ? 'rounded-bl-sm bg-white/[0.06] text-white' : 'rounded-bl-sm bg-gray-100 text-gray-900'}`}>
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      <p className={`mt-1 text-[10px] ${message.from === 'staff' ? 'text-white/70' : darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{message.at}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`flex items-end gap-2 border-t px-4 py-3 ${darkMode ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                <Smile className={`mb-2 h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <Input
                  placeholder={`Reply via ${labelFor(active.channel)}…`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
                  className={darkMode ? 'border-white/10 bg-[#0a0a1a]' : ''}
                />
                <Button onClick={send} disabled={!draft.trim()} className="bg-fuchsia-600 hover:bg-fuchsia-700"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-[360px] place-items-center p-8 text-center">
              <div className="max-w-sm">
                <WifiOff className={`mx-auto h-10 w-10 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                <b className={`mt-4 block ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Guest inbox ready</b>
                <p className={`mt-2 text-sm leading-relaxed ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>No fake guest messages are shown in production. Connect WhatsApp Business, hotel email or web chat and real conversations can populate this workspace.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <ChannelBadge channel="whatsapp" />
                  <ChannelBadge channel="email" />
                  <ChannelBadge channel="webchat" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function labelFor(channel: Channel) {
  return channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'Web chat';
}

function ChannelDot({ channel }: { channel: Channel }) {
  const tone = channel === 'whatsapp' ? 'bg-emerald-500' : channel === 'email' ? 'bg-sky-500' : 'bg-fuchsia-500';
  return <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />;
}

function ChannelBadge({ channel }: { channel: Channel }) {
  const Icon = channel === 'whatsapp' ? Phone : channel === 'email' ? Mail : MessageSquare;
  const tone = channel === 'whatsapp'
    ? 'bg-emerald-500/10 text-emerald-500'
    : channel === 'email'
      ? 'bg-sky-500/10 text-sky-500'
      : 'bg-fuchsia-500/10 text-fuchsia-500';
  return <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${tone}`}><Icon className="h-3 w-3" />{labelFor(channel)}</span>;
}
