import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  HotelRoomEntryEvent,
  HotelRoomPresenceState,
  HotelStaffBadgeScan,
  type RoomEntryAttribution,
  type RoomEntryTransition,
  type RoomEntryPolicyFlag,
  type StaffBadgeRole,
} from './hotel-room-entry.entity';
import { HotelRoomSignalLink } from './hotel-room-link.entity';
import { HotelBooking } from '../hotel/hotel.entity';

interface RuViewZoneSnapshot {
  id: string;
  peopleCount: number;
  occupied: boolean;
  lastSeenAt?: string;
}

const BADGE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Polls RuView every 15 seconds, compares zone occupancy against the last
 * persisted state per room, and writes one HotelRoomEntryEvent per
 * transition. Attributes the entry to either:
 *   1. The active booking guest (room is CHECKED_IN at that timestamp)
 *   2. A staff badge scanned at the door within the last 5 minutes
 *   3. 'unknown' otherwise
 *
 * Applies the workflow policy:
 *   • Cleaner badge scanned while booking is still CHECKED_IN
 *     → flag the entry as 'cleaner_before_checkout' (operator review).
 *   • Movement detected with no badge AND no checked-in booking
 *     → flag 'unknown_entry_during_stay'.
 */
@Injectable()
export class RoomEntryService {
  private readonly logger = new Logger(RoomEntryService.name);
  private readonly ruviewBaseUrl: string;

  constructor(
    @InjectRepository(HotelRoomEntryEvent)
    private readonly events: Repository<HotelRoomEntryEvent>,
    @InjectRepository(HotelRoomPresenceState)
    private readonly states: Repository<HotelRoomPresenceState>,
    @InjectRepository(HotelStaffBadgeScan)
    private readonly badges: Repository<HotelStaffBadgeScan>,
    @InjectRepository(HotelRoomSignalLink)
    private readonly links: Repository<HotelRoomSignalLink>,
    @InjectRepository(HotelBooking)
    private readonly bookings: Repository<HotelBooking>,
    config: ConfigService,
  ) {
    this.ruviewBaseUrl = config.get<string>('RUVIEW_BASE_URL') ?? 'http://localhost:3000';
  }

  // ── Public reads ─────────────────────────────────────────────────────────

  listRoomEntries(ownerId: string, roomId: string, limit = 100) {
    return this.events.find({
      where: { ownerId, roomId },
      order: { detectedAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  /**
   * Per-room entry stats over rolling windows. Returns the breakdown that
   * WiFi-CSI + bookings + badges can honestly support:
   *
   *   sessions          vacant→occupied transitions ("a new occupancy began")
   *   midStayEntries    head-count climbed while occupied ("someone joined
   *                     an occupied room" — same room, different person)
   *   personEntries     sessions + midStayEntries ("total individual entries")
   *   distinctGuests    distinct bookingId among guest-attributed entries
   *   distinctStaff     distinct staffId among badge-attributed entries
   *   unattributed      entries with attribution='unknown' (need review)
   *
   * One row per room with today / 7d / 30d / all-time tallies for each.
   */
  async countRoomOccupancies(ownerId: string) {
    const windows: Array<['today' | 'last7d' | 'last30d' | 'allTime', string]> = [
      ['today', `e."detectedAt" >= date_trunc('day', now())`],
      ['last7d', `e."detectedAt" >= now() - interval '7 days'`],
      ['last30d', `e."detectedAt" >= now() - interval '30 days'`],
      ['allTime', `TRUE`],
    ];
    const entryFilter = `(e.transition = 'vacant_to_occupied' OR (e.transition = 'people_count_changed' AND e."peopleAfter" > e."peopleBefore"))`;

    const qb = this.events
      .createQueryBuilder('e')
      .select('e."roomId"', 'roomId')
      .addSelect('e."roomNumber"', 'roomNumber');

    for (const [key, when] of windows) {
      qb.addSelect(`COUNT(*) FILTER (WHERE e.transition = 'vacant_to_occupied' AND ${when})`, `sessions_${key}`);
      qb.addSelect(`COUNT(*) FILTER (WHERE e.transition = 'people_count_changed' AND e."peopleAfter" > e."peopleBefore" AND ${when})`, `midStay_${key}`);
      qb.addSelect(`COUNT(*) FILTER (WHERE ${entryFilter} AND ${when})`, `personEntries_${key}`);
      qb.addSelect(`COUNT(DISTINCT e."bookingId") FILTER (WHERE e.attribution = 'guest_checked_in' AND ${when})`, `distinctGuests_${key}`);
      qb.addSelect(`COUNT(DISTINCT e."staffId") FILTER (WHERE e.attribution = 'staff_badge' AND ${when})`, `distinctStaff_${key}`);
      qb.addSelect(`COUNT(*) FILTER (WHERE e.attribution = 'unknown' AND ${entryFilter} AND ${when})`, `unattributed_${key}`);
    }

    const rows = await qb
      .where('e."ownerId" = :ownerId', { ownerId })
      .groupBy('e."roomId"')
      .addGroupBy('e."roomNumber"')
      .getRawMany<Record<string, string>>();

    const windowKeys: Array<'today' | 'last7d' | 'last30d' | 'allTime'> = ['today', 'last7d', 'last30d', 'allTime'];
    const pick = (r: Record<string, string>, prefix: string) =>
      Object.fromEntries(windowKeys.map((k) => [k, Number(r[`${prefix}_${k}`] ?? 0)])) as Record<typeof windowKeys[number], number>;

    return rows.map((r) => ({
      roomId: r.roomId,
      roomNumber: r.roomNumber,
      sessions:       pick(r, 'sessions'),
      midStayEntries: pick(r, 'midStay'),
      personEntries:  pick(r, 'personEntries'),
      distinctGuests: pick(r, 'distinctGuests'),
      distinctStaff:  pick(r, 'distinctStaff'),
      unattributed:   pick(r, 'unattributed'),
    }));
  }

  listRecentEntries(ownerId: string, limit = 50) {
    return this.events.find({
      where: { ownerId },
      order: { detectedAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  listPolicyFlagged(ownerId: string) {
    return this.events
      .createQueryBuilder('e')
      .where('e."ownerId" = :ownerId AND e."policyFlag" IS NOT NULL', { ownerId })
      .orderBy('e."detectedAt"', 'DESC')
      .limit(100)
      .getMany();
  }

  /**
   * Occupancy view for the front desk: every room with its current
   * presence state + the active booking (if any) + last entry event.
   * Used by the hotel app's "Room status" board.
   */
  async listRoomStatus(ownerId: string) {
    const allLinks = await this.links.find({ where: { ownerId, active: true } });
    if (!allLinks.length) return [];

    const states = await this.states.find({ where: { ownerId } });
    const stateByRoom = new Map(states.map((s) => [s.roomId, s]));

    const activeBookings = await this.bookings.find({
      where: { ownerId, status: 'CHECKED_IN' },
    });
    const bookingByRoom = new Map(activeBookings.map((b) => [b.roomId, b]));

    return Promise.all(
      allLinks.map(async (link) => {
        const last = await this.events.findOne({
          where: { ownerId, roomId: link.roomId },
          order: { detectedAt: 'DESC' },
        });
        const state = stateByRoom.get(link.roomId);
        const booking = bookingByRoom.get(link.roomId);
        return {
          roomId: link.roomId,
          roomNumber: link.roomNumber,
          zoneId: link.zoneId,
          occupied: state?.occupied ?? false,
          peopleCount: state?.peopleCount ?? 0,
          lastSeenAt: state?.lastSeenAt ?? null,
          lastEntryAt: last?.detectedAt ?? null,
          lastEntryTransition: last?.transition ?? null,
          lastAttribution: last?.attribution ?? null,
          lastPolicyFlag: last?.policyFlag ?? null,
          activeBooking: booking
            ? {
                id: booking.id,
                guestId: booking.guestId,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
              }
            : null,
        };
      }),
    );
  }

  // ── Staff badge scan ─────────────────────────────────────────────────────

  async scanStaffBadge(
    ownerId: string,
    input: { staffId: string; staffName: string; staffRole: StaffBadgeRole; roomId: string; roomNumber: string },
  ) {
    if (!input.staffId?.trim()) throw new BadRequestException('staffId is required');
    if (!input.roomId?.trim()) throw new BadRequestException('roomId is required');
    return this.badges.save(
      this.badges.create({
        ownerId,
        staffId: input.staffId,
        staffName: input.staffName,
        staffRole: input.staffRole ?? 'other',
        roomId: input.roomId,
        roomNumber: input.roomNumber,
        scannedAt: new Date(),
        consumed: false,
      }),
    );
  }

  // ── Ingest loop ──────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollRuView() {
    // Polls every owner that has at least one room↔zone link. RuView's
    // /api/v1/zones is single-tenant per server; we treat the whole
    // payload as the same tenant scope and let the link table filter
    // which zones belong to which hotel room.
    let zones: RuViewZoneSnapshot[];
    try {
      const res = await fetch(`${this.ruviewBaseUrl}/api/v1/zones`, {
        signal: AbortSignal.timeout?.(5000),
      });
      if (!res.ok) return;
      const json = await res.json();
      zones = Array.isArray(json) ? (json as RuViewZoneSnapshot[]) : [];
    } catch {
      // RuView container not running — nothing to do this tick.
      return;
    }
    if (!zones.length) return;

    const zoneById = new Map(zones.map((z) => [z.id, z]));
    const allLinks = await this.links.find({ where: { active: true } });
    for (const link of allLinks) {
      const zone = zoneById.get(link.zoneId);
      if (!zone) continue;
      try {
        await this.ingestForRoom(link.ownerId, link, zone);
      } catch (err) {
        this.logger.warn(`ingest failed for room ${link.roomNumber}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Single-room ingest: compute the transition (if any), write an entry
   * event, update presence state, attach attribution, apply policy.
   */
  private async ingestForRoom(
    ownerId: string,
    link: HotelRoomSignalLink,
    zone: RuViewZoneSnapshot,
  ): Promise<void> {
    const now = new Date();
    const prev = await this.states.findOne({ where: { ownerId, roomId: link.roomId } });

    const peopleBefore = prev?.peopleCount ?? 0;
    const peopleAfter = Number(zone.peopleCount ?? 0);
    const occupiedAfter = Boolean(zone.occupied ?? peopleAfter > 0);
    const occupiedBefore = prev?.occupied ?? false;

    // Decide whether this is a transition worth recording. We log
    // empty→occupied, occupied→empty, and head-count changes (e.g.
    // someone walks in while another is already inside).
    let transition: RoomEntryTransition | null = null;
    if (!occupiedBefore && occupiedAfter) transition = 'vacant_to_occupied';
    else if (occupiedBefore && !occupiedAfter) transition = 'occupied_to_vacant';
    else if (occupiedBefore && occupiedAfter && peopleBefore !== peopleAfter) transition = 'people_count_changed';

    // Update the persisted state regardless — we always want the latest
    // peopleCount + lastSeenAt for the front-desk board.
    await this.states.save({
      ...(prev ?? {}),
      ownerId,
      roomId: link.roomId,
      zoneId: link.zoneId,
      peopleCount: peopleAfter,
      occupied: occupiedAfter,
      lastSeenAt: now,
      lastTransitionAt: transition ? now : prev?.lastTransitionAt ?? null,
    } as HotelRoomPresenceState);

    if (!transition) return;

    // Attribution + policy
    const badge = await this.takePendingBadgeForRoom(ownerId, link.roomId, now);
    const booking = await this.bookings.findOne({
      where: { ownerId, roomId: link.roomId, status: 'CHECKED_IN' },
    });

    let attribution: RoomEntryAttribution = 'unknown';
    let staffId: string | null = null;
    let staffName: string | null = null;
    let staffRole: string | null = null;
    let bookingId: string | null = null;
    let guestName: string | null = null;
    let policyFlag: RoomEntryPolicyFlag = null;
    let notes = '';

    const peopleJoined = peopleAfter > peopleBefore;
    const isEntryEvent = transition === 'vacant_to_occupied' || (transition === 'people_count_changed' && peopleJoined);

    if (badge) {
      attribution = 'staff_badge';
      staffId = badge.staffId;
      staffName = badge.staffName;
      staffRole = badge.staffRole;
      // Cleaner badge while a guest is still checked in → policy flag.
      if (badge.staffRole === 'cleaner' && booking) {
        policyFlag = 'cleaner_before_checkout';
        notes = `Cleaner ${badge.staffName} entered room ${link.roomNumber} while booking ${booking.id.slice(0, 8)} is still CHECKED_IN.`;
      }
    } else if (transition === 'vacant_to_occupied' && booking) {
      // No badge, but there's an active booking — first entry of the stay is the guest.
      attribution = 'guest_checked_in';
      bookingId = booking.id;
      guestName = `Guest of booking ${booking.id.slice(0, 8)}`;
    } else if (isEntryEvent && !badge) {
      // Either vacant→occupied with no booking, OR head-count climbed during
      // a stay with no badge scan. WiFi-CSI saw a new person enter; we
      // can't identify them; needs operator review.
      policyFlag = 'unknown_entry_during_stay';
      notes = booking
        ? `Room ${link.roomNumber} head-count rose from ${peopleBefore} to ${peopleAfter} during booking ${booking.id.slice(0, 8)} with no staff badge. Additional unknown entry.`
        : `Room ${link.roomNumber} became occupied with no active booking and no staff badge. Operator review required.`;
    }

    await this.events.save(
      this.events.create({
        ownerId,
        roomId: link.roomId,
        roomNumber: link.roomNumber,
        zoneId: link.zoneId,
        transition,
        peopleBefore,
        peopleAfter,
        detectedAt: now,
        attribution,
        bookingId,
        guestName,
        staffId,
        staffName,
        staffRole,
        policyFlag,
        notes,
      }),
    );
  }

  /**
   * Pulls the most recent unconsumed badge scan for this room within the
   * BADGE_WINDOW_MS window and marks it consumed. Returns null if no
   * eligible badge is on file.
   */
  private async takePendingBadgeForRoom(ownerId: string, roomId: string, now: Date) {
    const since = new Date(now.getTime() - BADGE_WINDOW_MS);
    const badge = await this.badges
      .createQueryBuilder('b')
      .where('b."ownerId" = :ownerId AND b."roomId" = :roomId AND b.consumed = false AND b."scannedAt" >= :since', {
        ownerId,
        roomId,
        since,
      })
      .orderBy('b."scannedAt"', 'DESC')
      .getOne();
    if (badge) {
      badge.consumed = true;
      await this.badges.save(badge);
    }
    return badge;
  }

  async resolvePolicyFlag(ownerId: string, eventId: string, notes: string) {
    const ev = await this.events.findOne({ where: { ownerId, id: eventId } });
    if (!ev) throw new NotFoundException('Entry event not found');
    ev.policyFlag = null;
    if (notes) ev.notes = ev.notes ? `${ev.notes}\n— Resolved: ${notes}` : `Resolved: ${notes}`;
    return this.events.save(ev);
  }
}
