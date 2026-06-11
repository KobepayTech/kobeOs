import React, { useEffect, useMemo, useState } from 'react';
import {
  connectRuViewStream,
  getRuViewSnapshot,
  type RuViewConnectionStatus,
  type RuViewHealth,
  type RuViewZone,
} from '@/services/ruviewClient';
import { buildHotelRoomAudits, type HotelRoomAudit, type HotelRoomRisk } from '@/services/kobeHotelPms';
import { createHotelRoomReview, listHotelRoomReviews, type HotelRoomReviewRecord } from '@/services/hotelSecurityApi';
import { RoomEntryDashboard } from './RoomEntryDashboard';

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

function percent(value: number) { return `${Math.round(value * 100)}%`; }

function reviewSummary(audit: HotelRoomAudit) {
  return [
    `Room ${audit.room.roomNumber} / ${audit.room.roomType}`,
    `PMS ${audit.room.roomStatus}. Booking ${audit.room.bookingStatus}. Payment ${audit.room.paymentStatus}.`,
    `RuView ${audit.zone?.occupied ? 'occupied' : 'clear'}${audit.zone ? `, people ${audit.zone.peopleCount}, confidence ${percent(audit.zone.confidence)}.` : '.'}`,
    `Reason: ${audit.reasons.join(' ')}`,
    `Action: ${audit.action}`,
  ].join('\n');
}

type HotelSecurityTab = 'audits' | 'entries';

export default function HotelSecurity() {
  const [health, setHealth] = useState<RuViewHealth>(defaultHealth);
  const [zones, setZones] = useState<RuViewZone[]>([]);
  const [reviews, setReviews] = useState<HotelRoomReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'backend' | 'demo'>('demo');
  const [tab, setTab] = useState<HotelSecurityTab>('audits');

  async function refresh() {
    const snapshot = await getRuViewSnapshot();
    setHealth(snapshot.health);
    setZones(snapshot.zones);
    try {
      const backendReviews = await listHotelRoomReviews();
      setReviews(backendReviews);
      setDataSource(backendReviews.length > 0 ? 'backend' : 'demo');
    } catch {
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
    });
    return () => { window.clearInterval(interval); disconnect(); };
  }, []);

  const audits = useMemo(() => buildHotelRoomAudits(zones), [zones]);
  const flaggedRooms = audits.filter((audit) => audit.risk !== 'normal');
  const occupiedHotelZones = zones.filter((zone) => zone.type === 'hotel-room' && zone.occupied);

  async function saveReview(audit: HotelRoomAudit) {
    const optimistic: HotelRoomReviewRecord = {
      id: `local-review-${Date.now()}`,
      roomId: audit.room.roomId,
      roomNumber: audit.room.roomNumber,
      risk: audit.risk,
      state: 'open',
      title: audit.title,
      summary: reviewSummary(audit),
      snapshot: { room: audit.room, zone: audit.zone, reasons: audit.reasons, action: audit.action },
    };
    setReviews((current) => [optimistic, ...current]);
    try {
      const saved = await createHotelRoomReview({
        roomId: optimistic.roomId,
        roomNumber: optimistic.roomNumber,
        risk: optimistic.risk,
        state: optimistic.state,
        title: optimistic.title,
        summary: optimistic.summary,
        snapshot: optimistic.snapshot,
      });
      setReviews((current) => [saved, ...current.filter((item) => item.id !== optimistic.id)]);
      setDataSource('backend');
    } catch {
      // Shared api() queues offline writes when possible.
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/80 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-purple-300">KobeHotel Module</p>
            <h1 className="mt-1 text-3xl font-bold">Hotel Security</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">Room review, checkout confirmation, housekeeping timing, payment checks, and RuView hotel-room sensing.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <HotelTopTabBtn active={tab === 'audits'} onClick={() => setTab('audits')}>Audits</HotelTopTabBtn>
              <HotelTopTabBtn active={tab === 'entries'} onClick={() => setTab('entries')}>Room entries</HotelTopTabBtn>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(health.status)}`}>RuView {health.status}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">Data: {dataSource}</span>
            <button onClick={refresh} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">Refresh</button>
          </div>
        </div>
      </div>

      {tab === 'entries' ? (
        <RoomEntryDashboard />
      ) : (
        <AuditsView
          audits={audits}
          flaggedRooms={flaggedRooms}
          occupiedHotelZones={occupiedHotelZones}
          reviews={reviews}
          loading={loading}
          saveReview={saveReview}
        />
      )}
    </div>
  );
}

function AuditsView({
  audits,
  flaggedRooms,
  occupiedHotelZones,
  reviews,
  loading,
  saveReview,
}: {
  audits: HotelRoomAudit[];
  flaggedRooms: HotelRoomAudit[];
  occupiedHotelZones: RuViewZone[];
  reviews: HotelRoomReviewRecord[];
  loading: boolean;
  saveReview: (audit: HotelRoomAudit) => Promise<void>;
}) {
  return (
    <>
      <div className="grid gap-4 p-6 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">PMS rooms</p><p className="mt-2 text-3xl font-bold">{audits.length}</p><p className="mt-1 text-xs text-slate-500">Mapped to sensing zones</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Occupied zones</p><p className="mt-2 text-3xl font-bold">{occupiedHotelZones.length}</p><p className="mt-1 text-xs text-slate-500">RuView hotel-room status</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Room flags</p><p className="mt-2 text-3xl font-bold">{flaggedRooms.length}</p><p className="mt-1 text-xs text-slate-500">PMS + RuView checks</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Saved reviews</p><p className="mt-2 text-3xl font-bold">{reviews.length}</p><p className="mt-1 text-xs text-slate-500">Backend records</p></div>
      </div>

      <div className="px-6 pb-6">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Room audit</h2><p className="text-sm text-slate-400">Review PMS room state against RuView zone state.</p></div>{loading && <span className="text-sm text-slate-400">Loading...</span>}</div>
          <div className="grid gap-3 xl:grid-cols-3">
            {audits.map((audit) => (
              <div key={audit.room.roomId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Room {audit.room.roomNumber}</h3><p className="mt-1 text-xs text-slate-400">{audit.room.roomType} • Floor {audit.room.floor}</p></div><span className={`rounded-full border px-2 py-1 text-xs uppercase ${riskClasses(audit.risk)}`}>{audit.risk}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-950 p-3"><p className="text-slate-500">PMS</p><p className="font-semibold capitalize">{audit.room.roomStatus}</p></div><div className="rounded-xl bg-slate-950 p-3"><p className="text-slate-500">Booking</p><p className="font-semibold capitalize">{audit.room.bookingStatus}</p></div><div className="rounded-xl bg-slate-950 p-3"><p className="text-slate-500">Payment</p><p className="font-semibold capitalize">{audit.room.paymentStatus}</p></div><div className="rounded-xl bg-slate-950 p-3"><p className="text-slate-500">RuView</p><p className="font-semibold">{audit.zone?.occupied ? 'Occupied' : 'Clear'}</p></div></div>
                <p className="mt-4 font-medium">{audit.title}</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-400">{audit.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
                <p className="mt-3 rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-300">{audit.action}</p>
                {audit.risk !== 'normal' && <button onClick={() => saveReview(audit)} className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500">Save room review</button>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="px-6 pb-6">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"><h2 className="text-xl font-semibold">Saved room reviews</h2>{reviews.length === 0 ? <p className="mt-3 text-sm text-slate-400">No saved reviews yet.</p> : <div className="mt-4 space-y-3">{reviews.slice(0, 10).map((review) => <div key={review.id} className="rounded-xl border border-white/10 bg-slate-950 p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium">{review.title}</p><span className={`rounded-full border px-2 py-1 text-xs ${riskClasses(review.risk)}`}>{review.risk}</span></div><p className="mt-1 text-xs text-slate-500">Room {review.roomNumber} • {review.state}</p><p className="mt-2 whitespace-pre-line text-sm text-slate-300">{review.summary}</p></div>)}</div>}</section>
      </div>
    </>
  );
}

function HotelTopTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
        active
          ? 'bg-purple-500/15 text-purple-200 border border-purple-500/30'
          : 'border border-transparent text-white/60 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      {children}
    </button>
  );
}
