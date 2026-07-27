import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Wifi, Copy, Check, RefreshCw } from 'lucide-react';
import { apiBase } from '@/lib/api';

interface LanAddress { iface: string; ip: string; url: string }
interface LanInfo { serverId: string; name: string; version: string; host: string; port: number; addresses: LanAddress[] }

/**
 * "Connect over WiFi" — shows this server's local-network addresses and a QR so
 * other devices (phones, tablets, a second PC) can reach KobeOS on the same
 * WiFi WITHOUT internet: scan → open http://<lan-ip>:<port>. Reads the public
 * /lan/info discovery endpoint.
 */
export function NetworkTab() {
  const [info, setInfo] = useState<LanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${apiBase()}/lan/info`, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInfo(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(text); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  };

  const primary = info?.addresses?.[0]?.url ?? '';

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Wifi className="w-5 h-5 text-os-accent" /> Connect over WiFi</h2>
        <p className="text-os-text-secondary text-sm mt-1">
          On the same WiFi network, other devices can reach KobeOS directly — even with no internet.
          Scan the code or open the address in a browser.
        </p>
      </div>

      {loading && <div className="text-os-text-secondary text-sm">Finding this server’s network addresses…</div>}
      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Couldn’t read network info ({error}). Is the backend running?
          <button onClick={load} className="ml-2 underline inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>
        </div>
      )}

      {info && info.addresses.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-os-text-secondary">
          No WiFi/LAN address detected — this machine may only have a loopback interface. Connect it to WiFi or Ethernet to share KobeOS locally.
        </div>
      )}

      {info && info.addresses.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className="bg-white p-3 rounded-xl shrink-0">
            <QRCodeSVG value={primary} size={200} level="M" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-os-text-secondary mb-1">Server</div>
              <div className="text-sm font-medium">{info.name} <span className="text-os-text-secondary">· v{info.version}</span></div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-os-text-secondary mb-1">Addresses on this network</div>
              <div className="space-y-1.5">
                {info.addresses.map((a) => (
                  <div key={a.url} className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-1.5">
                    <span className="text-[11px] text-os-text-secondary w-12 shrink-0">{a.iface}</span>
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-os-accent truncate flex-1">{a.url}</a>
                    <button onClick={() => copy(a.url)} title="Copy" className="text-os-text-secondary hover:text-white shrink-0">
                      {copied === a.url ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-os-text-secondary leading-relaxed">
        <b className="text-os-text-primary">Tip:</b> for the full app to load on a phone over WiFi, open the address over
        <code className="mx-1 px-1 rounded bg-white/10">http://</code> (not https) so the app and data share one origin —
        a browser won’t mix an https page with a local http server.
      </div>
    </div>
  );
}
