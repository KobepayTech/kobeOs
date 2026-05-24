import { useState, useEffect, useCallback } from 'react';
import {
  Cpu, HardDrive, Wifi, WifiOff, Battery, Monitor,
  Activity, Package, Mic, Eye, Brain, Volume2,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Usb, Bluetooth, Printer, CreditCard,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRuntime } from '@/hooks/useRuntime';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceStatus { running: boolean; [k: string]: unknown }
interface DriverInfo    { id: string; name: string; version: string }
interface HALDisplay    { width?: number; height?: number; scaleFactor?: number }
interface HALNetwork    { [iface: string]: { address?: string; family?: string }[] }
interface HALPower      { percent?: number; isCharging?: boolean; onBattery?: boolean }
interface RuntimeStatus { booted: boolean; services: string[]; drivers: string[] }

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge className={`text-[10px] gap-1 ${ok ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </Badge>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color = 'text-slate-400' }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <Card className="bg-[#13131f] border-white/[0.06]">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.04] shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
          <p className="text-sm font-semibold text-white/80 truncate">{value}</p>
          {sub && <p className="text-[10px] text-white/20 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SystemDashboard() {
  const rt = useRuntime();

  const [runtimeStatus, setRuntimeStatus]   = useState<RuntimeStatus | null>(null);
  const [audioStatus,   setAudioStatus]     = useState<ServiceStatus | null>(null);
  const [cloudStatus,   setCloudStatus]     = useState<ServiceStatus | null>(null);
  const [aiStatus,      setAiStatus]        = useState<ServiceStatus | null>(null);
  const [fileStatus,    setFileStatus]      = useState<ServiceStatus | null>(null);
  const [deviceStatus,  setDeviceStatus]    = useState<ServiceStatus | null>(null);
  const [display,       setDisplay]         = useState<HALDisplay | null>(null);
  const [network,       setNetwork]         = useState<HALNetwork | null>(null);
  const [power,         setPower]           = useState<HALPower | null>(null);
  const [volume,        setVolume]          = useState<number | null>(null);
  const [loading,       setLoading]         = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rs, as, cs, ais, fs, ds, disp, net, pwr, vol] = await Promise.allSettled([
        rt.status(),
        rt.audio.status(),
        rt.cloud.status(),
        rt.ai.status(),
        rt.file.status(),
        rt.devices.status(),
        rt.hal.display(),
        rt.hal.network(),
        rt.hal.power(),
        rt.audio.getVolume(),
      ]);
      if (rs.status === 'fulfilled') setRuntimeStatus(rs.value as RuntimeStatus);
      if (as.status === 'fulfilled') setAudioStatus(as.value as ServiceStatus);
      if (cs.status === 'fulfilled') setCloudStatus(cs.value as ServiceStatus);
      if (ais.status === 'fulfilled') setAiStatus(ais.value as ServiceStatus);
      if (fs.status === 'fulfilled') setFileStatus(fs.value as ServiceStatus);
      if (ds.status === 'fulfilled') setDeviceStatus(ds.value as ServiceStatus);
      if (disp.status === 'fulfilled') setDisplay(disp.value as HALDisplay);
      if (net.status === 'fulfilled') setNetwork(net.value as HALNetwork);
      if (pwr.status === 'fulfilled') setPower(pwr.value as HALPower);
      if (vol.status === 'fulfilled') setVolume(vol.value as number);
    } finally {
      setLoading(false);
    }
  }, [rt]);

  useEffect(() => { refresh(); }, [refresh]);

  // Derive network info
  const netIfaces = network ? Object.entries(network).filter(([, addrs]) =>
    addrs.some(a => a.family === 'IPv4' && a.address !== '127.0.0.1')
  ) : [];
  const isOnline = (cloudStatus as { online?: boolean } | null)?.online ?? false;

  // Services list
  const services = [
    { label: 'Audio',   icon: Volume2,  status: audioStatus,  color: 'text-cyan-400' },
    { label: 'AI',      icon: Brain,    status: aiStatus,     color: 'text-violet-400' },
    { label: 'Files',   icon: HardDrive, status: fileStatus,  color: 'text-amber-400' },
    { label: 'Cloud',   icon: isOnline ? Wifi : WifiOff, status: cloudStatus, color: isOnline ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Devices', icon: Usb,      status: deviceStatus, color: 'text-blue-400' },
  ];

  return (
    <div className="flex-1 overflow-auto bg-[#0a0a14] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">System Dashboard</h1>
          <p className="text-white/30 text-xs mt-0.5">Kobe Runtime — live status</p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}
          className="border-white/[0.08] text-white/40 hover:text-white text-xs h-8">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Runtime status bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <StatusBadge ok={!!runtimeStatus?.booted} label="Runtime" />
        <StatusBadge ok={isOnline} label={isOnline ? 'Online' : 'Offline'} />
        <StatusBadge ok={(aiStatus as { available?: boolean } | null)?.available ?? false} label="AI" />
        <StatusBadge ok={!!audioStatus?.running} label="Audio" />
        <StatusBadge ok={!!fileStatus?.running} label="Files" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={Monitor} label="Display" color="text-blue-400"
          value={display ? `${display.width ?? '?'} × ${display.height ?? '?'}` : '—'}
          sub={display?.scaleFactor ? `${display.scaleFactor}× scale` : undefined} />
        <KpiCard icon={Battery} label="Power" color="text-emerald-400"
          value={power?.percent != null ? `${power.percent}%` : '—'}
          sub={power?.isCharging ? 'Charging' : power?.onBattery ? 'On battery' : undefined} />
        <KpiCard icon={Volume2} label="Volume" color="text-cyan-400"
          value={volume != null ? `${volume}%` : '—'}
          sub={audioStatus?.running ? 'Audio active' : 'Audio off'} />
        <KpiCard icon={Usb} label="Devices" color="text-amber-400"
          value={String((deviceStatus as { devices?: number } | null)?.devices ?? 0)}
          sub="connected" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Services */}
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold text-white/60 mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Services
            </h3>
            <div className="space-y-2">
              {services.map(({ label, icon: Icon, status, color }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs text-white/60">{label}</span>
                  </div>
                  <StatusBadge ok={!!status?.running} label={status?.running ? 'Running' : 'Stopped'} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Network */}
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold text-white/60 mb-3 flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5" /> Network
            </h3>
            {netIfaces.length === 0 ? (
              <div className="flex items-center gap-2 text-white/20 text-xs py-2">
                <WifiOff className="w-4 h-4" /> No active interfaces
              </div>
            ) : (
              <div className="space-y-2">
                {netIfaces.map(([iface, addrs]) => (
                  <div key={iface} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                    <span className="text-xs text-white/40 font-mono">{iface}</span>
                    <span className="text-xs text-white/60 font-mono">
                      {addrs.find(a => a.family === 'IPv4')?.address ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-xs font-semibold text-white/60 mt-4 mb-3 flex items-center gap-2">
              <Package className="w-3.5 h-3.5" /> Drivers
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                { icon: Volume2,    label: 'Audio' },
                { icon: Eye,        label: 'Camera' },
                { icon: Bluetooth,  label: 'Bluetooth' },
                { icon: Printer,    label: 'POS' },
                { icon: CreditCard, label: 'Payment' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
                  <Icon className="w-3 h-3 text-white/30" />
                  <span className="text-[10px] text-white/40">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI status */}
        <Card className="bg-[#13131f] border-white/[0.06] lg:col-span-2">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold text-white/60 mb-3 flex items-center gap-2">
              <Brain className="w-3.5 h-3.5" /> AI Runtime
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Provider',  value: (aiStatus as { provider?: string } | null)?.provider ?? 'Ollama' },
                { label: 'Model',     value: (aiStatus as { model?: string } | null)?.model ?? '—' },
                { label: 'Available', value: (aiStatus as { available?: boolean } | null)?.available ? 'Yes' : 'No' },
                { label: 'Embed Model', value: (aiStatus as { embedModel?: string } | null)?.embedModel ?? 'nomic-embed-text' },
              ].map(({ label, value }) => (
                <div key={label} className="p-2.5 rounded-lg bg-white/[0.03]">
                  <p className="text-[10px] text-white/30">{label}</p>
                  <p className="text-xs text-white/70 font-medium mt-0.5 truncate">{String(value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
