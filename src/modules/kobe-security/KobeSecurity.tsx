import React, { useEffect, useMemo, useState } from 'react';
import {
  connectRuViewStream,
  createLocalIncident,
  getRuViewSnapshot,
  type KobeSecurityIncident,
  type RuViewAlert,
  type RuViewConnectionStatus,
  type RuViewHealth,
  type RuViewZone,
} from '@/services/ruviewClient';

type GuardPatrol = {
  id: string;
  guard: string;
  checkpoint: string;
  status: 'pending' | 'checked' | 'missed';
  dueAt: string;
};

const defaultHealth: RuViewHealth = {
  status: 'simulated',
  baseUrl: import.meta.env.VITE_RUVIEW_BASE_URL || 'http://localhost:3000',
  wsUrl: import.meta.env.VITE_RUVIEW_WS_URL || 'ws://localhost:3001',
  message: 'Loading RuView connector...',
  checkedAt: new Date().toISOString(),
};

const patrols: GuardPatrol[] = [
  { id: 'patrol-1', guard: 'Guard A', checkpoint: 'Main Gate QR', status: 'checked', dueAt: '21:00' },
  { id: 'patrol-2', guard: 'Guard B', checkpoint: 'Warehouse Gate A QR', status: 'pending', dueAt: '21:30' },
  { id: 'patrol-3', guard: 'Guard C', checkpoint: 'Hotel Corridor Floor 1 QR', status: 'pending', dueAt: '22:00' },
];

function statusClasses(status: RuViewConnectionStatus) {
  switch (status) {
    case 'online': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'degraded': return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    case 'offline': return 'bg-red-500/15 text-red-300 border-red-500/30';
    default: return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  }
}

function severityClasses(severity: RuViewAlert['severity']) {
  switch (severity) {
    case 'critical': return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'warning': return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    default: return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  }
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

export default function KobeSecurity() {
  const [health, setHealth] = useState<RuViewHealth>(defaultHealth);
  const [zones, setZones] = useState<RuViewZone[]>([]);
  const [alerts, setAlerts] = useState<RuViewAlert[]>([]);
  const [incidents, setIncidents] = useState<KobeSecurityIncident[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('Kobe Guard');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const snapshot = await getRuViewSnapshot();
    setHealth(snapshot.health);
    setZones(snapshot.zones);
    setAlerts(snapshot.alerts);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 10_000);
    const disconnect = connectRuViewStream((snapshot) => {
      if (snapshot.health) setHealth(snapshot.health);
      if (snapshot.zones) setZones(snapshot.zones);
      if (snapshot.alerts) setAlerts(snapshot.alerts);
    });

    return () => {
      window.clearInterval(interval);
      disconnect();
    };
  }, []);

  const occupiedZones = zones.filter((zone) => zone.occupied).length;
  const openAlerts = alerts.filter((alert) => alert.status === 'open');
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'critical');
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0],
    [selectedZoneId, zones],
  );

  const createIncidentFromAlert = (alert: RuViewAlert) => {
    setIncidents((current) => [createLocalIncident(alert, guardName), ...current]);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/80 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-red-300">KobeOS Module</p>
            <h1 className="mt-1 text-3xl font-bold">Kobe Security</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Guard operations, incident reporting, patrol checkpoints, and RuView WiFi/CSI sensing for hotels, warehouses, shops, schools, and offices.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(health.status)}`}>
              RuView {health.status}
            </span>
            <button onClick={refresh} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Live zones</p>
          <p className="mt-2 text-3xl font-bold">{zones.length}</p>
          <p className="mt-1 text-xs text-slate-500">RuView + manual security zones</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Occupied</p>
          <p className="mt-2 text-3xl font-bold">{occupiedZones}</p>
          <p className="mt-1 text-xs text-slate-500">Rooms, gates, warehouse zones</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Open alerts</p>
          <p className="mt-2 text-3xl font-bold">{openAlerts.length}</p>
          <p className="mt-1 text-xs text-slate-500">Require guard verification</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Critical</p>
          <p className="mt-2 text-3xl font-bold">{criticalAlerts.length}</p>
          <p className="mt-1 text-xs text-slate-500">Escalate after physical confirmation</p>
        </div>
      </div>

      <div className="grid gap-6 px-6 pb-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">RuView sensing zones</h2>
              <p className="text-sm text-slate-400">Occupancy, people count, motion level, and confidence from RuView or demo fallback.</p>
            </div>
            {loading && <span className="text-sm text-slate-400">Loading...</span>}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setSelectedZoneId(zone.id)}
                className={`rounded-2xl border p-4 text-left transition ${selectedZone?.id === zone.id ? 'border-red-400/60 bg-red-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{zone.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">{zone.building}{zone.floor ? ` • Floor ${zone.floor}` : ''}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${zone.occupied ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'}`}>
                    {zone.occupied ? 'Occupied' : 'Clear'}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">People</p>
                    <p className="font-semibold">{zone.peopleCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Motion</p>
                    <p className="font-semibold">{percent(zone.motionLevel)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Confidence</p>
                    <p className="font-semibold">{percent(zone.confidence)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Selected zone</h2>
          {selectedZone ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-2xl font-bold">{selectedZone.name}</p>
                <p className="mt-1 text-sm text-slate-400">{selectedZone.type} • Last signal {formatTime(selectedZone.lastSeenAt)}</p>
                <div className="mt-4 h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-red-500" style={{ width: percent(selectedZone.confidence) }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Signal confidence {percent(selectedZone.confidence)}</p>
              </div>
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                RuView is a sensing aid. Guards must verify important alerts physically or with approved security systems before escalation.
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No zones loaded yet.</p>
          )}
        </section>
      </div>

      <div className="grid gap-6 px-6 pb-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Alert center</h2>
              <p className="text-sm text-slate-400">Convert RuView alerts into guard incidents.</p>
            </div>
            <input
              value={guardName}
              onChange={(event) => setGuardName(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-red-400/70"
              placeholder="Guard name"
            />
          </div>

          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{alert.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{alert.zoneName} • {formatTime(alert.createdAt)}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs ${severityClasses(alert.severity)}`}>{alert.severity}</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{alert.description}</p>
                <button
                  onClick={() => createIncidentFromAlert(alert)}
                  className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500"
                >
                  Create incident
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Guard patrols</h2>
          <p className="text-sm text-slate-400">QR checkpoints for guards. Later this should connect to mobile scanner pages.</p>
          <div className="mt-4 space-y-3">
            {patrols.map((patrol) => (
              <div key={patrol.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <p className="font-semibold">{patrol.checkpoint}</p>
                  <p className="text-sm text-slate-400">{patrol.guard} • Due {patrol.dueAt}</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize text-slate-300">{patrol.status}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="font-semibold">Incidents created this session</h3>
            {incidents.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No incidents created yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {incidents.map((incident) => (
                  <div key={incident.id} className="rounded-xl border border-white/10 bg-slate-950 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{incident.title}</p>
                      <span className={`rounded-full border px-2 py-1 text-xs ${severityClasses(incident.severity)}`}>{incident.severity}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Created by {incident.createdBy} at {formatTime(incident.createdAt)}</p>
                    <p className="mt-2 text-sm text-slate-300">{incident.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="px-6 pb-6">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">RuView connector settings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-slate-400">REST API</p>
              <p className="mt-1 break-all text-sm font-medium">{health.baseUrl}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-slate-400">WebSocket</p>
              <p className="mt-1 break-all text-sm font-medium">{health.wsUrl}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-slate-400">Message</p>
              <p className="mt-1 text-sm font-medium">{health.message}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
