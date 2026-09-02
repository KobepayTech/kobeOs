import { useCallback, useEffect, useState } from 'react';
import { Globe2, Link as LinkIcon, Loader2, Trash2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface Channel {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  commissionPct: number;
  lastSyncAt?: string | null;
  hotelId?: string | null;
}

interface Props { darkMode: boolean }

/**
 * Persisted OTA/channel registry.
 *
 * The previous UI seeded fake Booking.com/Airbnb/Expedia connections and
 * simulated "Sync now" locally. This production version only shows records
 * actually stored for the owner and never claims an OTA is connected unless a
 * real integration adapter exists.
 */
export default function ChannelsTab({ darkMode }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api<Channel[]>('/hotel/channels', { offlineFallback: false });
      setChannels(Array.isArray(rows) ? rows : []);
    } catch (reason) {
      setError((reason as Error).message || 'Could not load channel settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addChannel = async () => {
    const name = window.prompt('Channel name (for example Booking.com, Airbnb, Expedia)')?.trim();
    if (!name) return;
    const rawCommission = window.prompt('Commission percentage', '0');
    if (rawCommission === null) return;
    const commissionPct = Number(rawCommission || 0);
    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
      setError('Commission must be between 0 and 100.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/hotel/channels', {
        method: 'POST',
        offlineFallback: false,
        body: JSON.stringify({
          name,
          type: 'ota',
          connected: false,
          commissionPct,
        }),
      });
      await load();
    } catch (reason) {
      setError((reason as Error).message || 'Could not save channel.');
    } finally {
      setBusy(false);
    }
  };

  const removeChannel = async (id: string) => {
    if (!window.confirm('Remove this channel configuration?')) return;
    setBusy(true);
    setError('');
    try {
      await api(`/hotel/channels/${id}`, { method: 'DELETE', offlineFallback: false });
      await load();
    } catch (reason) {
      setError((reason as Error).message || 'Could not remove channel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Persist OTA settings without pretending an external sync is active.
          </p>
        </div>
        <Button disabled={busy} onClick={() => void addChannel()} className="bg-teal-600 hover:bg-teal-700">
          <LinkIcon className="w-4 h-4 mr-1" /> Add channel
        </Button>
      </div>

      <div className={`rounded-2xl border p-4 ${darkMode ? 'border-amber-400/20 bg-amber-400/[0.06] text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        <div className="flex items-start gap-3">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <b className="text-sm">Live OTA sync is not connected in this MVP.</b>
            <p className="mt-1 text-xs opacity-75">
              Saved channel names and commission settings are real persisted data. Booking imports, inventory sync and OTA OAuth will only show as connected after a verified provider adapter is installed.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid min-h-44 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : channels.length === 0 ? (
        <Card className={darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}>
          <CardContent className="grid min-h-44 place-items-center p-6 text-center">
            <div>
              <Globe2 className="mx-auto h-9 w-9 text-slate-400" />
              <b className="mt-3 block">No channels configured</b>
              <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Add an OTA only to record its settings. KobeOS will not mark it connected without a live integration.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {channels.map((channel) => (
            <Card key={channel.id} className={darkMode ? 'bg-[#13131f] border-white/[0.06]' : 'bg-white border-gray-200'}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100">
                    <Globe2 className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{channel.name}</b>
                      <Badge variant="outline" className="border-slate-400/30 bg-slate-500/10 text-slate-500">
                        <WifiOff className="mr-1 h-3 w-3" /> Not connected
                      </Badge>
                    </div>
                    <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {channel.type || 'ota'} · commission {Number(channel.commissionPct || 0).toFixed(2)}%
                    </p>
                    <p className={`mt-1 text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      No verified sync timestamp.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeChannel(channel.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                    title="Remove channel configuration"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
