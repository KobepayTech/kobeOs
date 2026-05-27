import React, { useEffect, useMemo, useState } from 'react';
import {
  connectRuViewStream,
  getRuViewSnapshot,
  type KobeSecurityIncident,
  type RuViewConnectionStatus,
  type RuViewHealth,
  type RuViewZone,
} from '@/services/ruviewClient';
import { buildHotelRoomAudits, type HotelRoomAudit, type HotelRoomRisk } from '@/services/kobeHotelPms';

const defaultHealth: RuViewHealth = {
  status: 'simulated',
  baseUrl: import.meta.env.VITE_RUVIEW_BASE_URL || 'http://localhost:3000',
  wsUrl: import.meta.env.VITE_RUVIEW_WS_URL || 'ws://localhost:3001',
  message: 'Loading RuView connector...',
  checkedAt: new Date().toISOString(),
};

function statusClasses(status: RuViewConnectionStatus) {
  switch (status) {
    case 'online': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'degraded': return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    case 'offline': return 'bg-red-500/15 text-red-300 border-red-500/30';
    default: return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  }
}

function riskClasses(risk: HotelRoomRisk) {
  switch (risk) {
    case 'critical': return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'high': return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'watch': return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    default: return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
}

function severityClasses(severity: KobeSecurityIncident['severity']) {
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

function auditToIncident(audit: HotelRoomAudit, managerName: string): KobeSecurityIncident {
  const access = audit.room.lastAccess
    ? `Last access: ${audit.room.lastAccess.openedBy} using ${audit.room.lastAccess.accessType}.`
    : 'Last access: not available.';

  return {
    id: `hotel-room-audit-${audit.room.roomId}-${Date.now()}`,
    title: audit.title,
    zoneId: audit.zone?.id,
    severity: audit.risk === 'critical' ? 'critical' : audit.risk === 'normal' ? 'info' : 'warning',
    createdAt: new Date().toISOString(),
    createdBy: managerName,
    notes: [
      `Room ${audit.room.roomNumber} / ${audit.room.roomType}`,
      `PMS: ${audit.room.roomStatus}. Booking: ${audit.room.bookingStatus}. Payment: ${audit.room.paymentStatus}.`,
      `RuView: ${audit.zone?.occupied ? 'occupied' : 'clear'}${audit.zone ? `, people ${audit.zone.peopleCount}, confidence ${percent(audit.zone.confidence)}.` : '.'}`,
      access,
      `Reasons: ${audit.reasons.join(' ')}`,
      `Action: ${audit.action}`,
    ].join('\n'),
    status: 'open',
  };
}

export default function HotelSecurity() {
  const [health, setHealth] = useState<RuViewHealth>(defaultHealth);
  const [zones, setZones] = useState<RuViewZone[]>([]);
  const [managerName, setManagerName] = useState('Hotel Manager');
  const [incidents, setIncidents] = useState<KobeSecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const snapshot = await getRuViewSnapshot();
    setHealth(snapshot.health);
    setZones(snapshot.zones);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 10_000);
    const disconnect = connectRuViewStream((snapshot) => {
      if (snapshot.health) setHealth(snapshot.health);
      if (snapshot.zones) setZones(snapshot.zones);
    });

    return () => {
      window.clearInterval(interval);
      disconnect();
    };
  }, []);

  const audits = useMemo(() => buildHotelRoomAudits(zones), [zones]);
  const flaggedRooms = audits.filter((audit) => audit.risk !== 'normal');
  const criticalRooms = audits.filter((audit) => audit.risk === 'critical');
  const occupiedHotelZones = zones.filter((zone) => zone.type === 'hotel-room' && zone.occupied);

  const createIncidentFromAudit = (audit: HotelRoomAudit) => {
    setIncidents((current) => [auditToIncident(audit, managerName), ...current]);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/80 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-purple-300">KobeHotel Module</p>
            <h1 className="mt-1 text-3xl font-bold">Hotel Security</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              PMS room audit, checkout verification, housekeeping safety, staff access review, payment mismatch checks, and RuView hotel-room sensing.
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
          <p className="text-sm text-slate-400">PMS rooms mapped</p>
          <p className="mt-2 text-3xl font-bold">{audits.length}</p>
          <p className="mt-1 text-xs text-slate-500">KobeHotel rooms linked to RuView zones</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Occupied hotel zones</p>
          <p className="mt-2 text-3xl font-bold">{occupiedHotelZones.length}</p>
          <p className="mt-1 text-xs text-slate-500">RuView hotel-room occupancy</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Room flags</p>
          <p className="mt-2 text-3xl font-bold">{flaggedRooms.length}</p>
          <p className="mt-1 text-xs text-slate-500">PMS + RuView mismatch checks</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-slate-400">Critical reviews</p>
          <p className="mt-2 text-3xl font-bold">{criticalRooms.length}</p>
          <p className="mt-1 text-xs text-slate-500">Hold sale until verified</p>
        </div>
      </div>

      <div className="px-6 pb-6">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Room audit</h2>
              <p className="text-sm text-slate-400">Verify checkout, room resale, housekeeping entry, payment status, and staff access using PMS + RuView.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={managerName}
                onChange={(event) => setManagerName(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-purple-400/70"
                placeholder="Manager name"
              />
              {loading && <span className="text-sm text-slate-400">Loading...</span>}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {audits.map((audit) => (
              <div key={audit.room.roomId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Room {audit.room.roomNumber}</h3>
                    <p className="mt-1 text-xs text-slate-400">{audit.room.roomType} • Floor {audit.room.floor}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs uppercase ${riskClasses(audit.risk)}`}>{audit.risk}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-950 p-3">
                    <p className="text-slate-500">PMS</p>
                    <p className="font-semibold capitalize">{audit.room.roomStatus}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3">
                    <p className="text-slate-500">Booking</p>
                    <p className="font-semibold capitalize">{audit.room.bookingStatus}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3">
                    <p className="text-slate-500">Payment</p>
                    <p className="font-semibold capitalize">{audit.room.paymentStatus}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-3">
                    <p className="text-slate-500">RuView</p>
                    <p className="font-semibold">{audit.zone?.occupied ? 'Occupied' : 'Clear'}</p>
                  </div>
                </div>

                <p className="mt-4 font-medium">{audit.title}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-400">
                  {audit.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                </ul>
                {audit.room.lastAccess && (
                  <p className="mt-3 text-xs text-slate-500">Last access: {audit.room.lastAccess.openedBy} • {audit.room.lastAccess.accessType} • {formatTime(audit.room.lastAccess.openedAt)}</p>
                )}
                <p className="mt-3 rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-300">{audit.action}</p>
                {audit.risk !== 'normal' && (
                  <button onClick={() => createIncidentFromAudit(audit)} className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500">
                    Create hotel incident
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 px-6 pb-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Hotel incident log</h2>
          {incidents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No hotel incidents created in this session.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {incidents.map((incident) => (
                <div key={incident.id} className="rounded-xl border border-white/10 bg-slate-950 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{incident.title}</p>
                    <span className={`rounded-full border px-2 py-1 text-xs ${severityClasses(incident.severity)}`}>{incident.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Created by {incident.createdBy} at {formatTime(incident.createdAt)}</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{incident.notes}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Hotel security rules</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">Checked-out or vacant room + RuView occupancy → verify before resale.</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">Non-guest access after checkout + occupancy + no active booking → manager review.</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">Active booking + incomplete payment + occupancy → front-desk payment review.</div>
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100">RuView is a sensing aid. Managers must verify important room alerts physically before taking action.</div>
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
