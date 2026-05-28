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
import {
  createWorkItem,
  listClientSites,
  listSecurityClients,
  listServiceChecks,
  listWorkItems,
  type ClientSiteRecord,
  type SecurityClientRecord,
  type ServiceCheckRecord,
  type WorkItemRecord,
} from '@/services/kobeSecurityApi';

type GuardPatrol = {
  id: string;
  guard: string;
  site: string;
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

const demoClients: SecurityClientRecord[] = [
  { id: 'client-abc', name: 'ABC Logistics', contactName: 'Kelvin', contactPhone: null, registrationNumber: null, active: true },
  { id: 'client-kobe', name: 'Kobe Facility', contactName: 'Operations', contactPhone: null, registrationNumber: null, active: true },
  { id: 'client-retail', name: 'Retail Plaza', contactName: 'Manager', contactPhone: null, registrationNumber: null, active: true },
];

const demoSites: ClientSiteRecord[] = [
  { id: 'site-warehouse', clientId: 'client-abc', name: 'Mikocheni Warehouse', address: 'Dar es Salaam', plan: '24/7', zoneIds: ['warehouse-gate-a'] },
  { id: 'site-front-gate', clientId: 'client-kobe', name: 'Main Facility Gate', address: 'Dar es Salaam', plan: 'night', zoneIds: ['front-gate'] },
  { id: 'site-retail', clientId: 'client-retail', name: 'Retail Plaza Floor 1', address: 'Dar es Salaam', plan: 'day', zoneIds: ['cafe-zone-main'] },
];

const demoPatrols: GuardPatrol[] = [
  { id: 'patrol-1', guard: 'Guard A', site: 'Main Facility Gate', checkpoint: 'Main Gate QR', status: 'checked', dueAt: '21:00' },
  { id: 'patrol-2', guard: 'Guard B', site: 'Mikocheni Warehouse', checkpoint: 'Warehouse Gate A QR', status: 'pending', dueAt: '21:30' },
  { id: 'patrol-3', guard: 'Guard C', site: 'Retail Plaza Floor 1', checkpoint: 'Retail Corridor QR', status: 'pending', dueAt: '22:00' },
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

function getSiteZones(site: ClientSiteRecord, zones: RuViewZone[]) {
  return zones.filter((zone) => site.zoneIds?.includes(zone.id));
}

export default function KobeSecurity() {
  const [health, setHealth] = useState<RuViewHealth>(defaultHealth);
  const [zones, setZones] = useState<RuViewZone[]>([]);
  const [alerts, setAlerts] = useState<RuViewAlert[]>([]);
  const [clients, setClients] = useState<SecurityClientRecord[]>(demoClients);
  const [sites, setSites] = useState<ClientSiteRecord[]>(demoSites);
  const [checks, setChecks] = useState<ServiceCheckRecord[]>([]);
  const [workItems, setWorkItems] = useState<WorkItemRecord[]>([]);
  const [incidents, setIncidents] = useState<KobeSecurityIncident[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState(demoSites[0]?.id ?? null);
  const [guardName, setGuardName] = useState('Kobe Guard');
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'backend' | 'demo'>('demo');

  async function refresh() {
    const snapshot = await getRuViewSnapshot();
    setHealth(snapshot.health);
    setZones(snapshot.zones);
    setAlerts(snapshot.alerts);

    const [clientResult, siteResult, checkResult, workItemResult] = await Promise.allSettled([
      listSecurityClients(),
      listClientSites(),
      listServiceChecks(),
      listWorkItems(),
    ]);

    const backendClients = clientResult.status === 'fulfilled' ? clientResult.value : [];
    const backendSites = siteResult.status === 'fulfilled' ? siteResult.value : [];
    const backendChecks = checkResult.status === 'fulfilled' ? checkResult.value : [];
    const backendWorkItems = workItemResult.status === 'fulfilled' ? workItemResult.value : [];

    if (backendClients.length > 0 || backendSites.length > 0 || backendChecks.length > 0 || backendWorkItems.length > 0) {
      setClients(backendClients.length > 0 ? backendClients : demoClients);
      setSites(backendSites.length > 0 ? backendSites : demoSites);
      setChecks(backendChecks);
      setWorkItems(backendWorkItems);
      setDataSource('backend');
      if (!selectedSiteId && backendSites[0]) setSelectedSiteId(backendSites[0].id);
    } else {
      setClients(demoClients);
      setSites(demoSites);
      setChecks([]);
      setWorkItems([]);
      setDataSource('demo');
    }

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

  const selectedSite = useMemo(() => sites.find((site) => site.id === selectedSiteId) ?? sites[0], [selectedSiteId, sites]);
  const selectedSiteZones = useMemo(() => selectedSite ? getSiteZones(selectedSite, zones) : [], [selectedSite, zones]);
  const occupiedZones = zones.filter((zone) => zone.occupied).length;
  const openAlerts = alerts.filter((alert) => alert.status === 'open');
  const activeContracts = clients.filter((client) => client.active).length;
  const missedChecks = checks.filter((check) => check.status === 'missed');
  const openWorkItems = workItems.filter((item) => item.state === 'open');

  const createIncidentFromAlert = async (alert: RuViewAlert) => {
    setIncidents((current) => [createLocalIncident(alert, guardName), ...current]);
    try {
      const saved = await createWorkItem({
        title: alert.title,
        priority: alert.severity === 'critical' ? 'urgent' : alert.severity === 'warning' ? 'high' : 'normal',
        state: 'open',
        details: `${alert.zoneName}: ${alert.description}`,
      });
      setWorkItems((current) => [saved, ...current]);
      setDataSource('backend');
    } catch {
      // Offline writes are queued by the shared api() client when possible.
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/80 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-red-300">KobeOS Module</p>
            <h1 className="mt-1 text-3xl font-bold">Kobe Security</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Security-company operations for clients, sites, teams, route checks, site signals, and operational work items.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(health.status)}`}>RuView {health.status}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">Data: {dataSource}</span>
            <button onClick={refresh} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">Refresh</button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Clients</p><p className="mt-2 text-3xl font-bold">{activeContracts}</p><p className="mt-1 text-xs text-slate-500">Active contracts</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Client sites</p><p className="mt-2 text-3xl font-bold">{sites.length}</p><p className="mt-1 text-xs text-slate-500">Backend + demo fallback</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Occupied zones</p><p className="mt-2 text-3xl font-bold">{occupiedZones}</p><p className="mt-1 text-xs text-slate-500">RuView site zones</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Open alerts</p><p className="mt-2 text-3xl font-bold">{openAlerts.length + openWorkItems.length}</p><p className="mt-1 text-xs text-slate-500">Signals + work items</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Missed checks</p><p className="mt-2 text-3xl font-bold">{missedChecks.length}</p><p className="mt-1 text-xs text-slate-500">Route SLA</p></div>
      </div>

      <div className="grid gap-6 px-6 pb-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Security clients</h2>
          <div className="mt-4 space-y-3">
            {clients.map((client) => (
              <div key={client.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="font-semibold">{client.name}</p><p className="text-sm text-slate-400">{sites.filter((site) => site.clientId === client.id).length} site(s)</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs ${client.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'}`}>{client.active ? 'active' : 'inactive'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-semibold">Client sites and RuView zones</h2><p className="text-sm text-slate-400">Backend sites are linked to RuView zone IDs for gates, warehouses, routes, and client reports.</p></div>
            {loading && <span className="text-sm text-slate-400">Loading...</span>}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {sites.map((site) => (
              <button key={site.id} onClick={() => setSelectedSiteId(site.id)} className={`rounded-2xl border p-4 text-left transition ${selectedSite?.id === site.id ? 'border-red-400/60 bg-red-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                <h3 className="font-semibold">{site.name}</h3>
                <p className="mt-1 text-xs text-slate-400">{site.address || 'No address'} • {site.plan}</p>
                <p className="mt-3 text-sm text-slate-300">{getSiteZones(site, zones).filter((zone) => zone.occupied).length} occupied zone(s)</p>
              </button>
            ))}
          </div>
          {selectedSite && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950 p-4">
              <h3 className="font-semibold">{selectedSite.name}</h3>
              <p className="mt-1 text-sm text-slate-400">Linked RuView zones for this client site</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedSiteZones.length === 0 ? <p className="text-sm text-slate-400">No RuView zones linked yet.</p> : selectedSiteZones.map((zone) => (
                  <div key={zone.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3"><p className="font-medium">{zone.name}</p><span className={`rounded-full px-2 py-1 text-xs ${zone.occupied ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'}`}>{zone.occupied ? 'Occupied' : 'Clear'}</span></div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400"><span>People {zone.peopleCount}</span><span>Motion {percent(zone.motionLevel)}</span><span>Confidence {percent(zone.confidence)}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 px-6 pb-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-semibold">Site alert center</h2><p className="text-sm text-slate-400">Convert RuView site alerts into persisted backend work items.</p></div>
            <input value={guardName} onChange={(event) => setGuardName(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-red-400/70" placeholder="Guard name" />
          </div>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{alert.title}</h3><p className="mt-1 text-sm text-slate-400">{alert.zoneName} • {formatTime(alert.createdAt)}</p></div><span className={`rounded-full border px-2 py-1 text-xs ${severityClasses(alert.severity)}`}>{alert.severity}</span></div>
                <p className="mt-3 text-sm text-slate-300">{alert.description}</p>
                <button onClick={() => createIncidentFromAlert(alert)} className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500">Create site work item</button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Route checks and work items</h2>
          <p className="text-sm text-slate-400">Shows backend route checks when available, otherwise demo patrol route examples.</p>
          <div className="mt-4 space-y-3">
            {(checks.length > 0 ? checks.map((check) => ({ id: check.id, checkpoint: check.checkpointName, guard: check.memberId, site: 'Backend route', dueAt: formatTime(check.checkedAt), status: check.status })) : demoPatrols).map((patrol) => (
              <div key={patrol.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div><p className="font-semibold">{patrol.checkpoint}</p><p className="text-sm text-slate-400">{patrol.guard} • {patrol.site} • {patrol.dueAt}</p></div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize text-slate-300">{patrol.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="font-semibold">Work items created this session</h3>
            {incidents.length === 0 && workItems.length === 0 ? <p className="mt-2 text-sm text-slate-400">No work items created yet.</p> : (
              <div className="mt-3 space-y-3">
                {incidents.map((incident) => <div key={incident.id} className="rounded-xl border border-white/10 bg-slate-950 p-3"><p className="font-medium">{incident.title}</p><p className="mt-1 text-xs text-slate-500">Created by {incident.createdBy} at {formatTime(incident.createdAt)}</p><p className="mt-2 whitespace-pre-line text-sm text-slate-300">{incident.notes}</p></div>)}
                {workItems.slice(0, 8).map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950 p-3"><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.priority} • {item.state}</p><p className="mt-2 text-sm text-slate-300">{item.details}</p></div>)}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
