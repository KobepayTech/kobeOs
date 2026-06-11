/**
 * Room entry dashboard for Hotel Security.
 *
 * Surfaces the entry-event timeline driven by the backend's RoomEntryService
 * (which polls RuView every 30s, detects occupancy transitions, attributes
 * each entry to the active booking or a recently-scanned staff badge, and
 * flags policy violations like "cleaner entered before checkout").
 *
 * Three panels:
 *   1. Room status grid — every linked room with live occupancy + last entry
 *   2. Recent entries — chronological feed across all rooms
 *   3. Policy flagged — entries needing operator review (resolvable inline)
 *
 * Staff badge scanner at the top simulates a door-side QR/NFC tap: the next
 * RuView transition for that room within 5 minutes gets attributed to the
 * staff member. The right gate for "only cleaner can enter after checkout".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, RefreshCw, ScanLine, AlertTriangle, CheckCircle2, ArrowDownToLine,
  ArrowUpFromLine, Users, DoorOpen, Shield, Sparkles, Wrench,
} from 'lucide-react';

type Transition = 'vacant_to_occupied' | 'occupied_to_vacant' | 'people_count_changed';
type Attribution = 'guest_checked_in' | 'staff_badge' | 'unknown';
type PolicyFlag = 'cleaner_before_checkout' | 'unknown_entry_during_stay' | 'after_hours_access' | null;
type StaffRole = 'cleaner' | 'security' | 'maintenance' | 'manager' | 'other';

interface RoomStatusRow {
  roomId: string;
  roomNumber: string;
  zoneId: string;
  occupied: boolean;
  peopleCount: number;
  lastSeenAt: string | null;
  lastEntryAt: string | null;
  lastEntryTransition: Transition | null;
  lastAttribution: Attribution | null;
  lastPolicyFlag: PolicyFlag;
  activeBooking: { id: string; guestId: string; checkIn: string; checkOut: string } | null;
}

type CountWindow = 'today' | 'last7d' | 'last30d' | 'allTime';
type WindowedCount = Record<CountWindow, number>;

interface OccupancyCount {
  roomId: string;
  roomNumber: string;
  sessions: WindowedCount;
  midStayEntries: WindowedCount;
  personEntries: WindowedCount;
  distinctGuests: WindowedCount;
  distinctStaff: WindowedCount;
  unattributed: WindowedCount;
}

interface EntryEvent {
  id: string;
  roomId: string;
  roomNumber: string;
  zoneId: string;
  transition: Transition;
  peopleBefore: number;
  peopleAfter: number;
  detectedAt: string;
  attribution: Attribution;
  bookingId: string | null;
  guestName: string | null;
  staffId: string | null;
  staffName: string | null;
  staffRole: string | null;
  policyFlag: PolicyFlag;
  notes: string;
}

const TRANSITION_LABEL: Record<Transition, string> = {
  vacant_to_occupied: 'Entered',
  occupied_to_vacant: 'Left',
  people_count_changed: 'Head-count changed',
};
const TRANSITION_ICON: Record<Transition, React.ComponentType<{ className?: string }>> = {
  vacant_to_occupied: ArrowDownToLine,
  occupied_to_vacant: ArrowUpFromLine,
  people_count_changed: Users,
};

const ATTRIBUTION_LABEL: Record<Attribution, string> = {
  guest_checked_in: 'Guest (booking)',
  staff_badge:      'Staff badge',
  unknown:          'Unknown',
};

const POLICY_FLAG_LABEL: Record<NonNullable<PolicyFlag>, string> = {
  cleaner_before_checkout: 'Cleaner entered before checkout',
  unknown_entry_during_stay: 'Unknown entry during stay',
  after_hours_access: 'After-hours access',
};

const ROLE_ICON: Record<StaffRole, React.ComponentType<{ className?: string }>> = {
  cleaner: Sparkles,
  security: Shield,
  maintenance: Wrench,
  manager: Shield,
  other: Users,
};

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function RoomEntryDashboard() {
  const [statusRows, setStatusRows] = useState<RoomStatusRow[]>([]);
  const [recent, setRecent] = useState<EntryEvent[]>([]);
  const [flagged, setFlagged] = useState<EntryEvent[]>([]);
  const [counts, setCounts] = useState<OccupancyCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r, f, c] = await Promise.all([
        api<RoomStatusRow[]>('/hotel-security/room-status'),
        api<EntryEvent[]>('/hotel-security/room-entries'),
        api<EntryEvent[]>('/hotel-security/room-entries/flagged'),
        api<OccupancyCount[]>('/hotel-security/room-occupancy-counts'),
      ]);
      setStatusRows(s ?? []);
      setRecent(r ?? []);
      setFlagged(f ?? []);
      setCounts(c ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load room entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15_000);
    return () => clearInterval(poll);
  }, [load]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-amber-300" /> Room entries (RuView + badge)
          </h2>
          <p className="text-[11px] text-white/40">
            Every occupancy transition is recorded with attribution. WiFi-CSI alone
            cannot tell two strangers apart — staff badge scans close that gap.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-7">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">{error}</div>
      )}

      <BadgeScanner onScanned={load} statusRows={statusRows} />

      <OccupancyTotals counts={counts} />

      <Section title={`Room status (${statusRows.length})`}>
        {statusRows.length === 0 ? (
          <Empty msg="No rooms linked to RuView zones yet. Link rooms in the Room Links tab." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {statusRows.map((row) => (
              <RoomStatusCard
                key={row.roomId}
                row={row}
                count={counts.find((c) => c.roomId === row.roomId) ?? null}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title={`Flagged for review (${flagged.length})`} highlight={flagged.length > 0}>
        {flagged.length === 0 ? (
          <Empty msg="Nothing flagged. All entries match the booking or have a valid badge." emerald />
        ) : (
          <div className="space-y-1.5">
            {flagged.map((e) => <FlaggedRow key={e.id} event={e} onResolved={load} />)}
          </div>
        )}
      </Section>

      <Section title={`Recent entries (${recent.length})`}>
        {recent.length === 0 ? (
          <Empty msg="Quiet — no recent transitions. The RuView ingest runs every 30s." />
        ) : (
          <div className="space-y-1">
            {recent.slice(0, 30).map((e) => <EntryRow key={e.id} event={e} />)}
          </div>
        )}
      </Section>
    </div>
  );
}

function BadgeScanner({ onScanned, statusRows }: { onScanned: () => Promise<void>; statusRows: RoomStatusRow[] }) {
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('cleaner');
  const [roomId, setRoomId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [justScanned, setJustScanned] = useState<string | null>(null);

  const scan = async () => {
    if (!staffName.trim() || !roomId) return;
    const target = statusRows.find((r) => r.roomId === roomId);
    if (!target) return;
    setScanning(true);
    try {
      await api('/hotel-security/staff-badge-scan', {
        method: 'POST',
        body: JSON.stringify({
          staffId: `staff-${staffName.toLowerCase().replace(/\s+/g, '-')}`,
          staffName,
          staffRole,
          roomId,
          roomNumber: target.roomNumber,
        }),
      });
      setJustScanned(`${staffName} → Room ${target.roomNumber}`);
      setTimeout(() => setJustScanned(null), 3000);
      await onScanned();
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card className="bg-amber-500/5 border-amber-500/30">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ScanLine className="w-4 h-4 text-amber-300" />
          Staff badge scan
          <span className="text-[10px] text-white/40 font-normal ml-auto">
            Next RuView transition for the picked room within 5 min is attributed to this staff member.
          </span>
        </div>
        <div className="grid grid-cols-12 gap-2">
          <Input
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="Staff name"
            className="bg-white/5 border-white/10 col-span-3"
          />
          <select
            value={staffRole}
            onChange={(e) => setStaffRole(e.target.value as StaffRole)}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 col-span-2"
          >
            <option value="cleaner">Cleaner</option>
            <option value="security">Security</option>
            <option value="maintenance">Maintenance</option>
            <option value="manager">Manager</option>
            <option value="other">Other</option>
          </select>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 col-span-4"
          >
            <option value="">— Pick a room —</option>
            {statusRows.map((r) => (
              <option key={r.roomId} value={r.roomId}>Room {r.roomNumber}</option>
            ))}
          </select>
          <Button onClick={scan} disabled={scanning || !staffName.trim() || !roomId} className="col-span-3 bg-amber-600 hover:bg-amber-500">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <ScanLine className="w-4 h-4 mr-1.5" />}
            Scan badge
          </Button>
        </div>
        {justScanned && (
          <p className="text-[11px] text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Scanned: {justScanned}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function OccupancyTotals({ counts }: { counts: OccupancyCount[] }) {
  const [win, setWin] = useState<CountWindow>('last7d');
  if (!counts.length) return null;
  const sum = (field: keyof Pick<OccupancyCount, 'sessions' | 'midStayEntries' | 'personEntries' | 'distinctGuests' | 'distinctStaff' | 'unattributed'>) =>
    counts.reduce((acc, c) => acc + (c[field][win] ?? 0), 0);
  const top = [...counts].sort((a, b) => b.personEntries[win] - a.personEntries[win]).slice(0, 3);
  return (
    <Card className="bg-emerald-500/5 border-emerald-500/30">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ArrowDownToLine className="w-4 h-4 text-emerald-300" />
          Entry stats
          <div className="ml-auto flex gap-1 text-[10px]">
            {(['today', 'last7d', 'last30d', 'allTime'] as CountWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={`px-1.5 py-0.5 rounded ${
                  win === w
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                    : 'text-white/50 hover:text-white border border-transparent'
                }`}
              >
                {w === 'today' ? 'Today' : w === 'last7d' ? '7d' : w === 'last30d' ? '30d' : 'All'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <Totals label="Sessions" hint="vacant → occupied" value={sum('sessions')} tone="emerald" />
          <Totals label="Mid-stay entries" hint="someone joined occupied room" value={sum('midStayEntries')} tone="amber" />
          <Totals label="Person entries" hint="sessions + mid-stay" value={sum('personEntries')} tone="emerald" />
          <Totals label="Distinct guests" hint="by booking" value={sum('distinctGuests')} tone="blue" />
          <Totals label="Distinct staff" hint="by badge" value={sum('distinctStaff')} tone="violet" />
          <Totals label="Unattributed" hint="no booking, no badge" value={sum('unattributed')} tone={sum('unattributed') > 0 ? 'rose' : 'mute'} />
        </div>
        {top.length > 0 && top[0].personEntries[win] > 0 && (
          <div className="text-[11px] text-white/60">
            Busiest this window:{' '}
            {top.map((c, i) => (
              <span key={c.roomId}>
                {i > 0 && ', '}
                <span className="text-white/90 font-medium">Room {c.roomNumber}</span>{' '}
                ({c.personEntries[win]} entries)
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-white/40 leading-relaxed">
          WiFi-CSI counts <em>person entries</em> (each new body crossing into the room) and identifies them through bookings + badges.
          It can't biometrically identify an unbadged stranger; those land in <span className="text-rose-300">unattributed</span> for operator review.
        </p>
      </CardContent>
    </Card>
  );
}

const TONE_CLS: Record<string, string> = {
  emerald: 'text-emerald-200',
  amber:   'text-amber-200',
  blue:    'text-blue-200',
  violet:  'text-violet-200',
  rose:    'text-rose-200',
  mute:    'text-white/60',
};

function Totals({ label, hint, value, tone }: { label: string; hint?: string; value: number; tone: keyof typeof TONE_CLS }) {
  return (
    <div className="rounded bg-white/[0.04] border border-white/10 px-2 py-1.5">
      <div className="text-[10px] text-white/40 uppercase tracking-wide">{label}</div>
      <div className={`text-base font-semibold ${TONE_CLS[tone]}`}>{value}</div>
      {hint && <div className="text-[9px] text-white/30 leading-tight mt-0.5">{hint}</div>}
    </div>
  );
}

function RoomStatusCard({ row, count }: { row: RoomStatusRow; count: OccupancyCount | null }) {
  const TransIcon = row.lastEntryTransition ? TRANSITION_ICON[row.lastEntryTransition] : null;
  return (
    <Card className={`bg-[#13131f] border ${row.lastPolicyFlag ? 'border-rose-500/40' : row.occupied ? 'border-emerald-500/30' : 'border-white/10'}`}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Room {row.roomNumber}</span>
          <Badge
            variant="outline"
            className={
              row.occupied
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-white/[0.05] text-white/50 border-white/10'
            }
          >
            {row.occupied ? `${row.peopleCount} ppl` : 'empty'}
          </Badge>
        </div>
        {row.activeBooking && (
          <div className="text-[10px] text-blue-200 bg-blue-500/10 border border-blue-500/30 rounded px-1.5 py-0.5 inline-block">
            CHECKED IN · booking {row.activeBooking.id.slice(0, 8)}
          </div>
        )}
        {row.lastEntryTransition && (
          <div className="text-[11px] text-white/70 flex items-center gap-1">
            {TransIcon && <TransIcon className="w-3 h-3" />}
            {TRANSITION_LABEL[row.lastEntryTransition]} ·{' '}
            {row.lastAttribution ? ATTRIBUTION_LABEL[row.lastAttribution] : '—'}
          </div>
        )}
        {row.lastPolicyFlag && (
          <div className="text-[10px] text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-0.5">
            <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
            {POLICY_FLAG_LABEL[row.lastPolicyFlag]}
          </div>
        )}
        <div className="text-[10px] text-white/40">
          Last entry {fmtTime(row.lastEntryAt)}
        </div>
        {count && (
          <div className="pt-1 border-t border-white/[0.06] space-y-0.5 text-[10px] text-white/60">
            <div className="flex items-center justify-between">
              <span>
                Entries <span className="text-emerald-300 font-semibold">{count.personEntries.today}</span> today
              </span>
              <span>
                7d <span className="text-white/80 font-semibold">{count.personEntries.last7d}</span>
              </span>
              <span>
                30d <span className="text-white/80 font-semibold">{count.personEntries.last30d}</span>
              </span>
            </div>
            {(count.midStayEntries.last7d > 0 || count.unattributed.last7d > 0) && (
              <div className="flex items-center justify-between text-[9px]">
                {count.midStayEntries.last7d > 0 && (
                  <span className="text-amber-300">+{count.midStayEntries.last7d} mid-stay/7d</span>
                )}
                {count.unattributed.last7d > 0 && (
                  <span className="text-rose-300">{count.unattributed.last7d} unattributed/7d</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EntryRow({ event }: { event: EntryEvent }) {
  const TransIcon = TRANSITION_ICON[event.transition];
  const RoleIcon = event.staffRole ? ROLE_ICON[event.staffRole as StaffRole] ?? Users : null;
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
        event.policyFlag ? 'bg-rose-500/10 border border-rose-500/30' : 'bg-white/[0.02]'
      }`}
    >
      <TransIcon className="w-3.5 h-3.5 text-white/60 shrink-0" />
      <span className="font-medium w-20 shrink-0">Room {event.roomNumber}</span>
      <span className="flex-1 min-w-0 truncate">
        {TRANSITION_LABEL[event.transition]} ·{' '}
        {event.attribution === 'staff_badge' && RoleIcon && (
          <span className="inline-flex items-center gap-1 text-amber-200">
            <RoleIcon className="w-3 h-3" />
            {event.staffName} ({event.staffRole})
          </span>
        )}
        {event.attribution === 'guest_checked_in' && (
          <span className="text-blue-200">Guest of booking {event.bookingId?.slice(0, 8)}</span>
        )}
        {event.attribution === 'unknown' && <span className="text-white/50">Unknown — no badge / no booking</span>}
      </span>
      <span className="text-white/40 text-[10px] shrink-0">{fmtTime(event.detectedAt)}</span>
    </div>
  );
}

function FlaggedRow({ event, onResolved }: { event: EntryEvent; onResolved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const resolve = async () => {
    setSaving(true);
    try {
      await api(`/hotel-security/room-entries/${event.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
      setOpen(false);
      setNotes('');
      await onResolved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-rose-500/5 border-rose-500/30">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-300" />
              Room {event.roomNumber} · {POLICY_FLAG_LABEL[event.policyFlag!]}
            </div>
            <div className="text-[11px] text-white/60 mt-1">{event.notes}</div>
            <div className="text-[10px] text-white/40 mt-1">{fmtTime(event.detectedAt)}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} className="text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
          </Button>
        </div>
        {open && (
          <div className="space-y-2 pt-1">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Resolution notes — what happened, who confirmed it"
              rows={2}
              className="bg-white/5 border-white/10 text-xs"
            />
            <Button size="sm" onClick={resolve} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
              Mark resolved
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, children, highlight }: { title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <h3 className={`text-sm font-medium mb-2 ${highlight ? 'text-rose-200' : 'text-white/80'}`}>{title}</h3>
      {children}
    </div>
  );
}

function Empty({ msg, emerald }: { msg: string; emerald?: boolean }) {
  return (
    <Card className={emerald ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.02] border-white/10'}>
      <CardContent className={`p-4 text-center text-xs ${emerald ? 'text-emerald-200' : 'text-white/40'}`}>{msg}</CardContent>
    </Card>
  );
}
