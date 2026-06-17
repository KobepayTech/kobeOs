import { useMemo, useState } from 'react';
import { MessageSquare, Mail, Phone, Search, Send, Smile } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Guest messaging inbox stub. Threads are seeded; replies stay in local
 * state. When the comms backend (WhatsApp Business API + IMAP + web chat
 * webhook) lands, swap the seeds for a /hotel/threads fetch and POST
 * /hotel/threads/:id/messages on send.
 */

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

const SEED_THREADS: Thread[] = [
  {
    id: 't1',
    guestName: 'Sarah Johnson',
    room: '#201',
    channel: 'whatsapp',
    lastAt: '2 min ago',
    unread: 2,
    messages: [
      { from: 'guest', text: 'Hi, can we extend checkout to 2pm?', at: '11:24' },
      { from: 'staff', text: 'Hi Sarah! Let me check availability and get back to you.', at: '11:26' },
      { from: 'guest', text: 'Also, can we get extra towels?', at: '11:31' },
      { from: 'guest', text: 'Thanks!', at: '11:31' },
    ],
  },
  {
    id: 't2',
    guestName: 'Michael Chen',
    room: '#203',
    channel: 'email',
    lastAt: '17 min ago',
    unread: 1,
    messages: [
      { from: 'guest', text: 'Could you book us a table at the rooftop restaurant tonight at 7pm for 2?', at: '10:48' },
    ],
  },
  {
    id: 't3',
    guestName: 'Theresa Webb',
    room: '#B25',
    channel: 'webchat',
    lastAt: '1 hr ago',
    unread: 0,
    messages: [
      { from: 'guest', text: 'Does the spa offer couples massage?', at: '09:50' },
      { from: 'staff', text: 'Yes! 90-min couples massage is TZS 220K. Want me to book?', at: '09:55' },
      { from: 'guest', text: 'Yes please, tomorrow 4pm if possible.', at: '10:05' },
      { from: 'staff', text: 'Booked. Confirmation in your room phone.', at: '10:08' },
    ],
  },
  {
    id: 't4',
    guestName: 'Jerome Bell',
    room: '#H29',
    channel: 'whatsapp',
    lastAt: 'yesterday',
    unread: 0,
    messages: [
      { from: 'guest', text: 'AC in the room is too loud at night.', at: 'yest 22:14' },
      { from: 'staff', text: 'Maintenance ticket #M178 opened. Engineer will visit by 11am.', at: 'yest 22:20' },
    ],
  },
];

interface Props { darkMode: boolean }

export default function GuestInboxTab({ darkMode }: Props) {
  const [threads, setThreads] = useState<Thread[]>(SEED_THREADS);
  const [activeId, setActiveId] = useState<string>(SEED_THREADS[0].id);
  const [filter, setFilter] = useState<'all' | Channel>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');

  const filtered = useMemo(() => threads.filter((t) => {
    if (filter !== 'all' && t.channel !== filter) return false;
    if (search && !`${t.guestName} ${t.room}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [threads, filter, search]);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setThreads((prev) => prev.map((t) =>
      t.id === activeId
        ? {
            ...t,
            lastAt: 'just now',
            messages: [...t.messages, { from: 'staff', text, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }],
          }
        : t,
    ));
    setDraft('');
  };

  const markRead = (id: string) => {
    setThreads((prev) => prev.map((t) => t.id === id ? { ...t, unread: 0 } : t));
    setActiveId(id);
  };

  const unreadTotal = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Inbox {unreadTotal > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-fuchsia-500/20 text-fuchsia-400 text-xs font-extrabold">
                {unreadTotal} unread
              </span>
            )}
          </h1>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Guest messages across WhatsApp, email and web chat</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'whatsapp', 'email', 'webchat'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className={filter === f ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : darkMode ? 'border-white/10' : ''}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : labelFor(f)}
            </Button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-12 gap-4 h-[600px] rounded-2xl border overflow-hidden ${darkMode ? 'border-white/[0.06] bg-[#13131f]' : 'border-gray-200 bg-white'}`}>
        {/* Thread list */}
        <div className={`col-span-4 border-r overflow-y-auto ${darkMode ? 'border-white/[0.06]' : 'border-gray-200'}`}>
          <div className="p-3 sticky top-0 backdrop-blur bg-inherit">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Search guests / rooms…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-8 ${darkMode ? 'bg-[#0a0a1a] border-white/10' : ''}`}
              />
            </div>
          </div>
          <ul>
            {filtered.map((t) => {
              const isActive = t.id === active.id;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => markRead(t.id)}
                    className={`w-full px-3 py-3 flex gap-2.5 items-start text-left border-b ${
                      darkMode ? 'border-white/[0.04]' : 'border-gray-100'
                    } ${isActive ? (darkMode ? 'bg-fuchsia-500/10' : 'bg-fuchsia-50') : darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}
                  >
                    <ChannelDot channel={t.channel} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold truncate">{t.guestName}</span>
                        <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t.lastAt}</span>
                      </div>
                      <div className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Room {t.room} · {labelFor(t.channel)}</div>
                      <div className={`text-xs mt-0.5 truncate ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t.messages[t.messages.length - 1]?.text}
                      </div>
                    </div>
                    {t.unread > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-fuchsia-500 text-white text-[10px] font-extrabold">
                        {t.unread}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className={`px-3 py-8 text-center text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No conversations</li>
            )}
          </ul>
        </div>

        {/* Active thread */}
        <div className="col-span-8 flex flex-col">
          <div className={`px-5 py-3 border-b ${darkMode ? 'border-white/[0.06]' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold">{active.guestName}</h3>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Room {active.room} · {labelFor(active.channel)}</p>
              </div>
              <ChannelBadge channel={active.channel} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {active.messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'staff' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.from === 'staff'
                    ? 'bg-fuchsia-600 text-white rounded-br-sm'
                    : darkMode ? 'bg-white/[0.06] text-white rounded-bl-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p className={`text-[10px] mt-1 ${m.from === 'staff' ? 'text-white/70' : darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    {m.at}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className={`px-4 py-3 border-t flex gap-2 items-end ${darkMode ? 'border-white/[0.06]' : 'border-gray-200'}`}>
            <Smile className={`w-5 h-5 mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <Input
              placeholder={`Reply via ${labelFor(active.channel)}…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              className={darkMode ? 'bg-[#0a0a1a] border-white/10' : ''}
            />
            <Button onClick={send} disabled={!draft.trim()} className="bg-fuchsia-600 hover:bg-fuchsia-700">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function labelFor(c: Channel) {
  return c === 'whatsapp' ? 'WhatsApp' : c === 'email' ? 'Email' : 'Web chat';
}

function ChannelDot({ channel }: { channel: Channel }) {
  const tone =
    channel === 'whatsapp' ? 'bg-emerald-500' :
    channel === 'email'    ? 'bg-sky-500' :
                              'bg-fuchsia-500';
  const Icon =
    channel === 'whatsapp' ? Phone :
    channel === 'email'    ? Mail :
                              MessageSquare;
  return (
    <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tone} text-white`}>
      <Icon className="w-4 h-4" />
    </span>
  );
}

function ChannelBadge({ channel }: { channel: Channel }) {
  const tone =
    channel === 'whatsapp' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    channel === 'email'    ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                              'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30';
  return <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border ${tone}`}>{labelFor(channel)}</span>;
}
