import { useState, useEffect } from 'react';
import { Globe2, RefreshCw, Link as LinkIcon, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

/**
 * Channel manager stub — surfaces the connection state for each OTA so a
 * GM can see at a glance whether bookings are flowing in. No live OAuth
 * yet; "Sync Now" just updates the local lastSync timestamp. Wire to a
 * real /hotel/channels endpoint when the integrations land.
 */

interface Channel {
  id: string;
  name: string;
  logoUrl: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string;
  rooms: number;
  bookings7d: number;
  commission: string;
  note: string;
}

const SEED_CHANNELS: Channel[] = [
  {
    id: 'booking',
    name: 'Booking.com',
    logoUrl: 'https://cf.bstatic.com/static/img/b25logo/booking_logo_white/cdf0a25b73ea2bd6b35f7a36ec79b41a13d4b09f.svg',
    status: 'connected',
    lastSync: '4 minutes ago',
    rooms: 18,
    bookings7d: 32,
    commission: '15%',
    note: 'Auto-sync every 5 min',
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Airbnb_Logo_B%C3%A9lo.svg',
    status: 'connected',
    lastSync: '12 minutes ago',
    rooms: 6,
    bookings7d: 11,
    commission: '14%',
    note: 'Auto-sync every 15 min',
  },
  {
    id: 'expedia',
    name: 'Expedia',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Expedia_2012_logo.svg',
    status: 'error',
    lastSync: '3 hours ago',
    rooms: 12,
    bookings7d: 7,
    commission: '18%',
    note: 'API key expired — refresh credentials',
  },
  {
    id: 'vrbo',
    name: 'Vrbo',
    logoUrl: '',
    status: 'disconnected',
    lastSync: 'never',
    rooms: 0,
    bookings7d: 0,
    commission: '—',
    note: 'Not connected',
  },
];

interface Props { darkMode: boolean }

export default function ChannelsTab({ darkMode }: Props) {
  const [channels, setChannels] = useState<Channel[]>(SEED_CHANNELS);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Load the owner's real channels from /hotel/channels; keep the seed when
  // signed out / none configured so the demo still renders.
  useEffect(() => {
    (async () => {
      try {
        const list = await api<Array<{ id: string; name: string; connected: boolean; commissionPct?: number; lastSyncAt?: string }>>('/hotel/channels');
        if (Array.isArray(list) && list.length) {
          setChannels(list.map((c) => ({
            id: c.id, name: c.name, logoUrl: '',
            status: c.connected ? 'connected' : 'disconnected',
            lastSync: c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : '—',
            rooms: 0, bookings7d: 0,
            commission: c.commissionPct ? `${c.commissionPct}%` : '—',
            note: c.connected ? '' : 'Not connected',
          })));
        }
      } catch { /* keep seed */ }
    })();
  }, []);

  const totalBookings = channels.reduce((s, c) => s + c.bookings7d, 0);
  const totalRooms    = channels.reduce((s, c) => s + c.rooms, 0);
  const connectedCount = channels.filter((c) => c.status === 'connected').length;

  const syncNow = async (id: string) => {
    setSyncingId(id);
    try {
      if (/^[0-9a-f-]{36}$/i.test(id)) await api(`/hotel/channels/${id}`, { method: 'PATCH', body: JSON.stringify({ connected: true }) });
      setChannels((prev) => prev.map((c) => c.id === id && c.status !== 'disconnected' ? { ...c, status: 'connected', lastSync: 'just now' } : c));
    } finally { setSyncingId(null); }
  };

  const connectOrFix = async (id: string) => {
    const channel = channels.find((c) => c.id === id);
    if (!channel) return;
    try {
      if (/^[0-9a-f-]{36}$/i.test(id)) {
        await api(`/hotel/channels/${id}`, { method: 'PATCH', body: JSON.stringify({ connected: true }) });
      } else {
        const created = await api<{ id: string }>('/hotel/channels', { method: 'POST', body: JSON.stringify({ name: channel.name, type: 'ota', connected: true, commissionPct: Number(channel.commission.replace('%', '')) || 0 }) });
        setChannels((prev) => prev.map((c) => c.id === id ? { ...c, id: created.id } : c));
      }
      setChannels((prev) => prev.map((c) => c.id === id ? { ...c, status: 'connected', lastSync: 'just now', note: 'Connection saved · sync ready', rooms: c.rooms || 8 } : c));
    } catch (e) { window.alert(`Could not connect ${channel.name}: ${(e as Error).message}`); }
  };

  const addChannel = async () => {
    const name = window.prompt('Channel name (e.g. Booking.com, Airbnb, direct website)')?.trim();
    if (!name) return;
    const commission = Number(window.prompt('Commission percentage', '15') || 0);
    try {
      const created = await api<{ id: string; name: string; connected: boolean; commissionPct?: number }>('/hotel/channels', { method: 'POST', body: JSON.stringify({ name, type: 'ota', connected: true, commissionPct: Number.isFinite(commission) ? commission : 0 }) });
      setChannels((prev) => [...prev, { id: created.id, name: created.name, logoUrl: '', status: 'connected', lastSync: 'just now', rooms: 0, bookings7d: 0, commission: `${created.commissionPct ?? commission}%`, note: 'Connection saved · sync ready' }]);
    } catch (e) { window.alert(`Could not add channel: ${(e as Error).message}`); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            OTA + direct-booking integrations
          </p>
        </div>
        <Button onClick={() => void addChannel()} className="bg-teal-600 hover:bg-teal-700">
          <LinkIcon className="w-4 h-4 mr-1" />Connect new channel
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat darkMode={darkMode} label="Connected channels" value={`${connectedCount} / ${channels.length}`} tone="text-emerald-400" />
        <Stat darkMode={darkMode} label="Rooms on OTAs"       value={String(totalRooms)}                       tone="text-cyan-400" />
        <Stat darkMode={darkMode} label="Bookings (7 days)"   value={String(totalBookings)}                    tone="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((c) => (
          <Card key={c.id} className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt={c.name} className="w-9 h-9 object-contain" />
                    ) : (
                      <Globe2 className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{c.name}</h3>
                    <p className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{c.note}</p>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <Cell darkMode={darkMode} label="Rooms"        value={String(c.rooms)} />
                <Cell darkMode={darkMode} label="Bookings 7d"  value={String(c.bookings7d)} />
                <Cell darkMode={darkMode} label="Commission"   value={c.commission} />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>
                  Last sync: <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{c.lastSync}</span>
                </span>
                {c.status === 'disconnected' ? (
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700 h-7" onClick={() => void connectOrFix(c.id)}>
                    <LinkIcon className="w-3 h-3 mr-1" />Connect
                  </Button>
                ) : c.status === 'error' ? (
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 h-7" onClick={() => void connectOrFix(c.id)}>
                    <AlertCircle className="w-3 h-3 mr-1" />Reconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-7 ${darkMode ? 'border-white/10 hover:bg-white/5' : ''}`}
                    onClick={() => void syncNow(c.id)}
                    disabled={syncingId === c.id}
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${syncingId === c.id ? 'animate-spin' : ''}`} />
                    {syncingId === c.id ? 'Syncing…' : 'Sync now'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ darkMode, label, value, tone }: { darkMode: boolean; label: string; value: string; tone: string }) {
  return (
    <Card className={`${darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}`}>
      <CardContent className="p-4">
        <p className={`text-3xl font-bold ${tone}`}>{value}</p>
        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
      </CardContent>
    </Card>
  );
}

function Cell({ darkMode, label, value }: { darkMode: boolean; label: string; value: string }) {
  return (
    <div className={`rounded-lg p-2 ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
      <div className={`text-[9px] uppercase tracking-wide font-semibold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: Channel['status'] }) {
  if (status === 'connected') {
    return (
      <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
        <Check className="w-3 h-3 mr-1" />Connected
      </Badge>
    );
  }
  if (status === 'error') {
    return (
      <Badge variant="outline" className="bg-rose-500/20 text-rose-400 border-rose-500/30">
        <AlertCircle className="w-3 h-3 mr-1" />Error
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-500/20 text-slate-400 border-slate-500/30">
      Disconnected
    </Badge>
  );
}
