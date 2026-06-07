/**
 * RuView dashboard for Kobe Security.
 *
 * Surfaces the full RuView feature set (presence, vitals, pose, falls,
 * sleep) inside KobeOS. Talks to the RuView sensing server documented at
 * https://github.com/ruvnet/RuView (MIT) via the shared ruviewClient
 * service — defaults to localhost:3000 / ws:3001 (matches the
 * vendor/ruview/docker-compose.yml sidecar) and falls back to simulated
 * frames when the container isn't running.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  connectRuViewStream,
  getRuViewSnapshot,
  type RuViewFall,
  type RuViewHealth,
  type RuViewPose,
  type RuViewSleep,
  type RuViewSnapshot,
  type RuViewVitals,
  type RuViewZone,
} from '@/services/ruviewClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, Heart, Users, AlertTriangle, Bed, Wifi, RefreshCw,
  ExternalLink, Copy, Check, Layout,
} from 'lucide-react';

type DashTab = 'overview' | 'vitals' | 'pose' | 'falls' | 'sleep' | 'setup';

const DEFAULT_HEALTH: RuViewHealth = {
  status: 'simulated',
  baseUrl: import.meta.env.VITE_RUVIEW_BASE_URL || 'http://localhost:3000',
  wsUrl: import.meta.env.VITE_RUVIEW_WS_URL || 'ws://localhost:3001',
  message: 'Connecting to RuView…',
  checkedAt: new Date().toISOString(),
};

export function RuViewDashboard() {
  const [snap, setSnap] = useState<RuViewSnapshot>({
    health: DEFAULT_HEALTH,
    zones: [],
    alerts: [],
    vitals: [],
    poses: [],
    falls: [],
    sleep: [],
  });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DashTab>('overview');
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const next = await getRuViewSnapshot();
    setSnap(next);
    setRefreshedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const disconnect = connectRuViewStream((partial) => {
      // Live WS frames patch over the polled snapshot.
      setSnap((prev) => ({
        ...prev,
        ...partial,
        health: partial.health ?? prev.health,
        zones: partial.zones ?? prev.zones,
        alerts: partial.alerts ?? prev.alerts,
        vitals: partial.vitals ?? prev.vitals,
        poses: partial.poses ?? prev.poses,
        falls: partial.falls ?? prev.falls,
        sleep: partial.sleep ?? prev.sleep,
      }));
      setRefreshedAt(new Date());
    });
    const poll = setInterval(load, 10_000);
    return () => {
      disconnect();
      clearInterval(poll);
    };
  }, [load]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a1a] text-white">
      <Header health={snap.health} loading={loading} onRefresh={load} refreshedAt={refreshedAt} />
      <Tabs tab={tab} setTab={setTab} counts={{
        zones: snap.zones.length,
        vitals: snap.vitals.length,
        poses: snap.poses.length,
        falls: snap.falls.length,
        sleep: snap.sleep.length,
      }} />
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === 'overview' && <OverviewTab snap={snap} />}
        {tab === 'vitals'   && <VitalsTab rows={snap.vitals} />}
        {tab === 'pose'     && <PoseTab rows={snap.poses} />}
        {tab === 'falls'    && <FallsTab rows={snap.falls} />}
        {tab === 'sleep'    && <SleepTab rows={snap.sleep} />}
        {tab === 'setup'    && <SetupTab health={snap.health} />}
      </div>
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({
  health,
  loading,
  onRefresh,
  refreshedAt,
}: {
  health: RuViewHealth;
  loading: boolean;
  onRefresh: () => void;
  refreshedAt: Date | null;
}) {
  const statusColor: Record<RuViewHealth['status'], string> = {
    online:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    offline:   'bg-rose-500/15 text-rose-300 border-rose-500/30',
    degraded:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
    simulated: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  };
  return (
    <div className="shrink-0 p-4 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Wifi className="w-4 h-4 text-cyan-300" />
          RuView · WiFi-CSI sensing
        </h1>
        <p className="text-[11px] text-white/40">
          Powered by RuView (MIT, github.com/ruvnet/RuView). Presence, vitals, pose, falls and sleep from CSI alone — no cameras.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={statusColor[health.status]}>
          {health.status.toUpperCase()}
        </Badge>
        <span className="text-[11px] text-white/40">{health.message}</span>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading} className="h-7">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        {refreshedAt && <span className="text-[10px] text-white/30">{refreshedAt.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}

// ── Tabs strip ──────────────────────────────────────────────────────────────

function Tabs({
  tab,
  setTab,
  counts,
}: {
  tab: DashTab;
  setTab: (t: DashTab) => void;
  counts: { zones: number; vitals: number; poses: number; falls: number; sleep: number };
}) {
  const items: Array<{ key: DashTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { key: 'overview', label: 'Overview',  icon: Users,         count: counts.zones },
    { key: 'vitals',   label: 'Vitals',    icon: Heart,         count: counts.vitals },
    { key: 'pose',     label: 'Pose',      icon: Activity,      count: counts.poses },
    { key: 'falls',    label: 'Falls',     icon: AlertTriangle, count: counts.falls },
    { key: 'sleep',    label: 'Sleep',     icon: Bed,           count: counts.sleep },
    { key: 'setup',    label: 'Setup',     icon: Layout },
  ];
  return (
    <div className="shrink-0 px-4 border-b border-white/[0.06] flex gap-1 overflow-x-auto">
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.key;
        return (
          <button
            key={it.key}
            onClick={() => setTab(it.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] whitespace-nowrap border-b-2 transition-colors ${
              active
                ? 'border-cyan-400 text-cyan-200'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {it.label}
            {typeof it.count === 'number' && (
              <span className="text-[10px] bg-white/[0.06] px-1 rounded">{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab({ snap }: { snap: RuViewSnapshot }) {
  const totalOccupied = snap.zones.filter((z) => z.occupied).length;
  const totalPeople = snap.zones.reduce((s, z) => s + z.peopleCount, 0);
  const criticalAlerts = snap.alerts.filter((a) => a.severity === 'critical').length;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Zones" value={String(snap.zones.length)} hint={`${totalOccupied} occupied`} />
        <Kpi label="People (CSI)" value={String(totalPeople)} hint={`across ${snap.zones.length} zones`} />
        <Kpi label="Alerts" value={String(snap.alerts.length)} hint={`${criticalAlerts} critical`} />
        <Kpi label="Falls today" value={String(snap.falls.length)} hint="real-time detection" />
      </div>

      <h3 className="text-sm font-medium pt-2">Zones</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {snap.zones.map((z) => <ZoneCard key={z.id} z={z} />)}
        {snap.zones.length === 0 && <Empty msg="No zones reported by RuView yet." />}
      </div>

      <h3 className="text-sm font-medium pt-2">Recent alerts</h3>
      <div className="space-y-1.5">
        {snap.alerts.map((a) => (
          <Card key={a.id} className="bg-[#13131f] border-white/10">
            <CardContent className="p-3 flex items-start gap-3">
              <Badge
                variant="outline"
                className={
                  a.severity === 'critical' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : a.severity === 'warning'  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                }
              >
                {a.severity.toUpperCase()}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-[11px] text-white/40">{a.zoneName} · {new Date(a.createdAt).toLocaleString()}</div>
                <div className="text-[11px] text-white/70 mt-1">{a.description}</div>
              </div>
            </CardContent>
          </Card>
        ))}
        {snap.alerts.length === 0 && <Empty msg="No alerts. Quiet shift." />}
      </div>
    </>
  );
}

function ZoneCard({ z }: { z: RuViewZone }) {
  const occ = z.occupied;
  return (
    <Card className={`bg-[#13131f] border ${occ ? 'border-emerald-500/30' : 'border-white/10'}`}>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{z.name}</span>
          <Badge
            variant="outline"
            className={occ ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/[0.05] text-white/50'}
          >
            {occ ? `${z.peopleCount} ppl` : 'empty'}
          </Badge>
        </div>
        <div className="text-[11px] text-white/50">{z.building}{z.floor ? ` · floor ${z.floor}` : ''}</div>
        <Bar label="Motion" value={z.motionLevel} />
        <Bar label="Confidence" value={z.confidence} accent="cyan" />
      </CardContent>
    </Card>
  );
}

// ── Vitals tab ──────────────────────────────────────────────────────────────

function VitalsTab({ rows }: { rows: RuViewVitals[] }) {
  if (rows.length === 0) return <Empty msg="No vital-sign readings yet. RuView publishes these per detected person." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {rows.map((v) => (
        <Card key={`${v.zoneId}-${v.personId}`} className="bg-[#13131f] border-white/10">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{v.zoneName}</span>
              <span className="text-[10px] text-white/40">{v.personId}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Metric label="Breathing" value={v.breathingBpm.toFixed(0)} unit="bpm" accent="emerald" />
              <Metric label="Heart rate" value={v.heartRateBpm.toFixed(0)} unit="bpm" accent="rose" />
            </div>
            <Bar label="Confidence" value={v.confidence} accent="cyan" />
            <div className="text-[10px] text-white/30">Captured {new Date(v.capturedAt).toLocaleTimeString()}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Pose tab ────────────────────────────────────────────────────────────────

function PoseTab({ rows }: { rows: RuViewPose[] }) {
  if (rows.length === 0) return <Empty msg="No pose frames yet. RuView estimates a 17-keypoint skeleton from CSI alone." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {rows.map((p) => (
        <Card key={`${p.zoneId}-${p.personId}`} className="bg-[#13131f] border-white/10">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{p.zoneName}</span>
              <span className="text-[10px] text-white/40">{p.personId}</span>
            </div>
            <PoseStick keypoints={p.keypoints} />
            <div className="text-[10px] text-white/30">Captured {new Date(p.capturedAt).toLocaleTimeString()}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PoseStick({ keypoints }: { keypoints: { x: number; y: number; score: number }[] }) {
  // Minimal skeleton viewer — RuView publishes COCO 17-point ordering.
  return (
    <svg viewBox="0 0 100 120" className="w-full h-40 bg-black/40 rounded">
      {keypoints.map((k, i) => (
        <circle
          key={i}
          cx={k.x * 100}
          cy={k.y * 100 + 10}
          r={1.6}
          fill={k.score > 0.6 ? '#22d3ee' : '#64748b'}
        />
      ))}
    </svg>
  );
}

// ── Falls tab ───────────────────────────────────────────────────────────────

function FallsTab({ rows }: { rows: RuViewFall[] }) {
  if (rows.length === 0) {
    return (
      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <CardContent className="p-4 text-center text-sm text-emerald-200">
          No falls detected.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((f) => (
        <Card key={f.id} className="bg-rose-500/5 border-rose-500/30">
          <CardContent className="p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-300 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                Fall detected — {f.zoneName}
              </div>
              <div className="text-[11px] text-white/50">
                {f.personId} · {f.severity.toUpperCase()} · {new Date(f.detectedAt).toLocaleString()}
              </div>
            </div>
            <Badge variant="outline" className={f.acknowledgedAt ? 'bg-white/[0.05] text-white/50' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'}>
              {f.acknowledgedAt ? 'ack' : 'open'}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Sleep tab ───────────────────────────────────────────────────────────────

function SleepTab({ rows }: { rows: RuViewSleep[] }) {
  if (rows.length === 0) return <Empty msg="No sleep data tonight. Enable an overnight room in RuView to track sleep quality." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {rows.map((s) => (
        <Card key={`${s.zoneId}-${s.personId}`} className="bg-[#13131f] border-white/10">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{s.zoneName}</span>
              <span className={`text-2xl font-bold ${s.scoreOutOf100 >= 80 ? 'text-emerald-300' : s.scoreOutOf100 >= 60 ? 'text-amber-300' : 'text-rose-300'}`}>
                {s.scoreOutOf100.toFixed(0)}
                <span className="text-xs text-white/30 ml-1">/100</span>
              </span>
            </div>
            <div className="text-[11px] text-white/60">
              Avg breathing {s.averageBreathingBpm.toFixed(0)} bpm · Apnea last hour {s.apneaEventsLastHour}
            </div>
            <div className="text-[10px] text-white/30">Captured {new Date(s.capturedAt).toLocaleTimeString()}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Setup tab ───────────────────────────────────────────────────────────────

function SetupTab({ health }: { health: RuViewHealth }) {
  const [copied, setCopied] = useState(false);
  const command = 'docker compose -f vendor/ruview/docker-compose.yml up -d';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this command:', command);
    }
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <Card className="bg-[#13131f] border-white/10">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-300" /> Start the RuView sidecar
          </h3>
          <p className="text-xs text-white/60">
            RuView ships as an official Docker image. KobeOS vendors a one-shot
            <code className="text-white/80 mx-1">docker-compose.yml</code> under
            <code className="text-white/80 mx-1">vendor/ruview/</code> so the sensing server
            comes up on the right ports without any configuration.
          </p>
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded p-2 font-mono text-[11px]">
            <span className="flex-1 truncate text-white/80">{command}</span>
            <Button size="sm" variant="ghost" onClick={copy} className="h-6 text-[11px]">
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-[11px] text-white/40">
            Re-open this app once the container is healthy — the status pill turns from
            <span className="text-blue-300 mx-1">SIMULATED</span> to
            <span className="text-emerald-300 mx-1">ONLINE</span>.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-[#13131f] border-white/10">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-medium">Endpoints</h3>
          <KvRow label="HTTP API" value={health.baseUrl} />
          <KvRow label="WebSocket" value={health.wsUrl} />
          <KvRow label="Status" value={health.status} />
          <KvRow label="Last check" value={new Date(health.checkedAt).toLocaleString()} />
        </CardContent>
      </Card>

      <Card className="bg-[#13131f] border-white/10">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-medium">Real ESP32 / Cognitum Seed hardware</h3>
          <p className="text-xs text-white/60">
            The Docker image runs RuView in simulator mode. For real sensing,
            follow the upstream firmware-flash + appliance setup, then point
            <code className="text-white/80 mx-1">VITE_RUVIEW_BASE_URL</code> /
            <code className="text-white/80 mx-1">VITE_RUVIEW_WS_URL</code> at the new host.
          </p>
          <a
            href="https://github.com/ruvnet/RuView"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> Upstream RuView (MIT)
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────────

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="bg-[#13131f] border-white/10">
      <CardContent className="p-3 space-y-0.5">
        <div className="text-[10px] uppercase text-white/40 tracking-wide">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        {hint && <p className="text-[10px] text-white/40">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: 'emerald' | 'rose' | 'cyan' }) {
  const cls = accent === 'emerald' ? 'text-emerald-300' : accent === 'rose' ? 'text-rose-300' : 'text-cyan-300';
  return (
    <div>
      <div className="text-[10px] uppercase text-white/40">{label}</div>
      <div className={`text-lg font-bold ${cls}`}>
        {value} <span className="text-xs text-white/40">{unit}</span>
      </div>
    </div>
  );
}

function Bar({ label, value, accent }: { label: string; value: number; accent?: 'cyan' | 'amber' }) {
  const bar = useMemo(() => Math.max(0, Math.min(1, value)), [value]);
  const color = accent === 'cyan' ? 'bg-cyan-400/80' : bar > 0.6 ? 'bg-amber-400/80' : 'bg-white/30';
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>{label}</span>
        <span>{Math.round(bar * 100)}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${bar * 100}%` }} />
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <Card className="bg-white/[0.02] border-white/10">
      <CardContent className="p-6 text-center text-sm text-white/40">{msg}</CardContent>
    </Card>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/40">{label}</span>
      <span className="font-mono text-white/80">{value}</span>
    </div>
  );
}
