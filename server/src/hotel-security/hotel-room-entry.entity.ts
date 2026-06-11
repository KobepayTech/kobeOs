import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type RoomEntryTransition = 'vacant_to_occupied' | 'occupied_to_vacant' | 'people_count_changed';

export type RoomEntryAttribution = 'guest_checked_in' | 'staff_badge' | 'unknown';

export type RoomEntryPolicyFlag =
  | 'cleaner_before_checkout'   // cleaner badge scanned while guest still checked in
  | 'unknown_entry_during_stay' // motion detected but no badge / guest expected
  | 'after_hours_access'        // outside the room's allowed access window
  | null;

/**
 * Every transition of a hotel room's occupancy is captured as one event:
 * empty → occupied, occupied → empty, or a head-count change. The event
 * stores who we believe entered (active booking guest, scanned staff badge,
 * or unknown) plus an optional policy flag that flags suspicious entries
 * (e.g. a cleaner badge while the room is still checked-in).
 *
 * RuView (https://github.com/ruvnet/RuView, MIT) gives us reliable
 * presence + per-session person count from CSI. It cannot tell two
 * separate people apart across re-entry, so attribution is closed by
 * either the existing booking record OR a staff badge scan at the door.
 */
@Entity('hotel_room_entry_events')
@Index(['ownerId', 'roomId', 'detectedAt'])
export class HotelRoomEntryEvent extends OwnedEntity {
  @Index()
  @Column('uuid')
  roomId!: string;

  @Column()
  roomNumber!: string;

  @Column()
  zoneId!: string;

  @Column()
  transition!: RoomEntryTransition;

  @Column({ default: 0 })
  peopleBefore!: number;

  @Column({ default: 0 })
  peopleAfter!: number;

  @Column({ type: 'timestamptz' })
  detectedAt!: Date;

  /** Attribution */
  @Column({ default: 'unknown' })
  attribution!: RoomEntryAttribution;

  @Index()
  @Column({ nullable: true, type: 'uuid' })
  bookingId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  guestName?: string | null;

  @Index()
  @Column({ nullable: true, type: 'uuid' })
  staffId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  staffName?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  staffRole?: string | null;   // 'cleaner' | 'security' | 'maintenance' | …

  /** Workflow gate */
  @Column({ nullable: true, type: 'varchar' })
  policyFlag?: RoomEntryPolicyFlag;

  /** Free-form notes — populated by the workflow gate or operator. */
  @Column({ default: '' })
  notes!: string;
}

/**
 * Last-known occupancy per (owner, room). The ingest cron reads this to
 * decide whether a new RuView snapshot constitutes a transition that
 * deserves a row in hotel_room_entry_events.
 */
@Entity('hotel_room_presence_state')
@Index(['ownerId', 'roomId'], { unique: true })
export class HotelRoomPresenceState extends OwnedEntity {
  @Index()
  @Column('uuid')
  roomId!: string;

  @Column()
  zoneId!: string;

  @Column({ default: 0 })
  peopleCount!: number;

  @Column({ default: false })
  occupied!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastTransitionAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt?: Date | null;
}

export type StaffBadgeRole = 'cleaner' | 'security' | 'maintenance' | 'manager' | 'other';

/**
 * A staff member can scan their badge at a room door (QR / NFC tap) so
 * the next RuView transition for that zone within ~5 minutes is
 * attributed to them. Closes RuView's identity gap.
 */
@Entity('hotel_staff_badge_scans')
@Index(['ownerId', 'roomId', 'scannedAt'])
export class HotelStaffBadgeScan extends OwnedEntity {
  @Index()
  @Column('uuid')
  staffId!: string;

  @Column()
  staffName!: string;

  @Column({ default: 'cleaner' })
  staffRole!: StaffBadgeRole;

  @Index()
  @Column('uuid')
  roomId!: string;

  @Column()
  roomNumber!: string;

  @Column({ type: 'timestamptz' })
  scannedAt!: Date;

  /** Set to true once we've matched this scan to an entry event. */
  @Column({ default: false })
  consumed!: boolean;
}
