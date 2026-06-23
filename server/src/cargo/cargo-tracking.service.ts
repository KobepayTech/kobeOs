import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsolidationBox, Parcel, ParcelLifecycleStatus, Shipment } from './cargo.entity';
import { Fr24Service } from './fr24.service';

/**
 * Public-facing tracking lookup — no auth, accepts any of:
 *   - parcelId            (operator-assigned label)
 *   - externalTracking    (upstream carrier number, e.g. YT88794…)
 *   - shipmentId          (operator-assigned label on the outbound box)
 *
 * Returns a sanitized snapshot: lifecycle status, weight, destination,
 * carrier, ETA, plus the most recent shipment hop. No PII: sender
 * /owner phone numbers and personal notes are stripped before
 * returning.
 */
export interface PublicTrackResult {
  reference: string;
  status: ParcelLifecycleStatus | 'UNKNOWN';
  destination: string;
  weight?: number;
  packageCount?: number;
  preAlertedAt?: string | null;
  externalTracking?: string | null;
  carrier?: string | null;
  flightNumber?: string | null;
  etd?: string | null;
  eta?: string | null;
  shipmentStatus?: string | null;
  /** Live flight position when IN_TRANSIT — null when there's no
   *  flight attached, no FR24 plan, or the upstream call failed.
   *  The tracking page uses this to embed an OpenStreetMap marker. */
  livePosition?: { latitude: number; longitude: number; altitude?: number | null; speedKts?: number | null } | null;
  /** Human-readable timeline derived from status + timestamps for the
   *  customer-facing UI. */
  timeline: Array<{ stage: string; at?: string | null; current: boolean }>;
}

const TIMELINE_ORDER: ParcelLifecycleStatus[] = [
  'PRE_ALERTED', 'AWAITING_STORAGE', 'STORED', 'FOR_CONSOLIDATION',
  'CONSOLIDATED', 'IN_TRANSIT', 'OVERSEAS_RECEIVED', 'READY_FOR_PICKUP', 'DELIVERED',
];

@Injectable()
export class CargoTrackingService {
  constructor(
    @InjectRepository(Parcel)            private readonly parcels: Repository<Parcel>,
    @InjectRepository(ConsolidationBox)  private readonly boxes:   Repository<ConsolidationBox>,
    @InjectRepository(Shipment)          private readonly shipments: Repository<Shipment>,
    private readonly fr24: Fr24Service,
  ) {}

  /** Best-effort live flight position from FR24. Returns null when
   *  FR24 isn't configured, the flight isn't found, or anything
   *  upstream fails. */
  private async livePosition(flightNumber: string | null | undefined) {
    if (!flightNumber) return null;
    try {
      const flight = await this.fr24.flightByNumber(flightNumber);
      if (!flight || flight.latitude == null || flight.longitude == null) return null;
      return {
        latitude: Number(flight.latitude),
        longitude: Number(flight.longitude),
        altitude: flight.altitude ?? null,
        speedKts: flight.groundSpeed ?? null,
      };
    } catch { return null; }
  }

  async lookup(reference: string): Promise<PublicTrackResult> {
    const ref = (reference ?? '').trim();
    if (!ref) throw new BadRequestException('reference is required');

    // Try the most common formats in order. Each query is owner-
    // scoped only by the column type (no ownerId filter — the reference
    // is the public key, like an Amazon tracking number).
    const parcel = await this.parcels.findOne({
      where: [
        { parcelId: ref },
        { externalTracking: ref },
      ],
    });
    if (parcel) return this.buildFromParcel(parcel);

    // Allow lookup by shipment id too — useful for operators sharing
    // tracking with a customer over WhatsApp.
    const shipment = await this.shipments.findOne({ where: { shipmentId: ref } });
    if (shipment) {
      return {
        reference: ref,
        status: shipment.status === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
        destination: shipment.destination,
        carrier: shipment.carrier ?? null,
        flightNumber: shipment.flightNumber ?? null,
        etd: shipment.etd?.toISOString?.() ?? null,
        eta: shipment.eta?.toISOString?.() ?? null,
        shipmentStatus: shipment.status,
        livePosition: await this.livePosition(shipment.flightNumber),
        timeline: this.buildTimeline('IN_TRANSIT'),
      };
    }

    throw new NotFoundException(`No parcel or shipment found for "${ref}"`);
  }

  private async buildFromParcel(p: Parcel): Promise<PublicTrackResult> {
    let shipment: Shipment | null = null;
    if (p.boxId) {
      const box = await this.boxes.findOne({ where: { id: p.boxId } });
      if (box?.shipmentId) {
        shipment = await this.shipments.findOne({ where: { id: box.shipmentId } });
      }
    }
    // Only fetch live position when the parcel is in flight — saves an
    // FR24 quota hit on every refresh of a parcel that's still in
    // storage or already delivered.
    const livePosition = p.lifecycleStatus === 'IN_TRANSIT'
      ? await this.livePosition(shipment?.flightNumber ?? null)
      : null;
    return {
      reference: p.parcelId,
      status: p.lifecycleStatus,
      destination: p.destination,
      weight: Number(p.weight),
      packageCount: p.packageCount,
      preAlertedAt: p.preAlertedAt?.toISOString?.() ?? null,
      externalTracking: p.externalTracking ?? null,
      carrier: shipment?.carrier ?? null,
      flightNumber: shipment?.flightNumber ?? null,
      etd: shipment?.etd?.toISOString?.() ?? null,
      eta: shipment?.eta?.toISOString?.() ?? null,
      shipmentStatus: shipment?.status ?? null,
      livePosition,
      timeline: this.buildTimeline(p.lifecycleStatus, {
        PRE_ALERTED: p.preAlertedAt?.toISOString?.() ?? null,
      }),
    };
  }

  private buildTimeline(
    current: ParcelLifecycleStatus,
    timestamps: Partial<Record<ParcelLifecycleStatus, string | null>> = {},
  ): PublicTrackResult['timeline'] {
    const currentIdx = TIMELINE_ORDER.indexOf(current);
    return TIMELINE_ORDER.map((stage, i) => ({
      stage,
      at: timestamps[stage] ?? null,
      current: i === currentIdx,
    })).filter((t) => TIMELINE_ORDER.indexOf(t.stage as ParcelLifecycleStatus) <= currentIdx + 1);
  }

  /** Pre-alert flow — operator-facing for now (the customer-app side
   *  will reuse this method once we add cargo customer auth). Stamps
   *  preAlertedAt and sets lifecycleStatus = PRE_ALERTED. If a parcel
   *  with the same externalTracking already exists for this owner,
   *  refuses to duplicate. */
  async createPreAlert(uid: string, dto: {
    customerId?: string;
    externalTracking: string;
    senderName?: string;
    senderPhone?: string;
    ownerName: string;
    ownerPhone: string;
    destination: string;
    description?: string;
    weight?: number;
    packageCount?: number;
  }): Promise<Parcel> {
    if (!dto.externalTracking?.trim()) throw new BadRequestException('externalTracking is required');
    if (!dto.ownerName?.trim() || !dto.ownerPhone?.trim() || !dto.destination?.trim()) {
      throw new BadRequestException('ownerName, ownerPhone, destination are required');
    }
    const existing = await this.parcels.findOne({
      where: { ownerId: uid, externalTracking: dto.externalTracking.trim() },
    });
    if (existing) {
      throw new BadRequestException(
        `Pre-alert exists for ${dto.externalTracking} (parcel ${existing.parcelId})`,
      );
    }
    const parcelId = `PA-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    return this.parcels.save(this.parcels.create({
      ownerId: uid,
      parcelId,
      senderName: dto.senderName ?? '',
      senderPhone: dto.senderPhone ?? '',
      ownerName: dto.ownerName,
      ownerPhone: dto.ownerPhone,
      destination: dto.destination,
      description: dto.description ?? '',
      weight: dto.weight ?? 0,
      packageCount: dto.packageCount ?? 1,
      customerId: dto.customerId ?? null,
      externalTracking: dto.externalTracking.trim(),
      preAlertedAt: new Date(),
      lifecycleStatus: 'PRE_ALERTED',
      status: 'PRE_ALERTED',
    }));
  }

  /** When the physical parcel arrives at the dock, match it to a
   *  pre-alert by external tracking number. Stamps the pre-alert
   *  to AWAITING_STORAGE and fills in any actual weight / count. */
  async receivePreAlert(uid: string, externalTracking: string, dto: {
    weight?: number; packageCount?: number;
  }): Promise<Parcel> {
    const parcel = await this.parcels.findOne({
      where: { ownerId: uid, externalTracking: externalTracking.trim() },
    });
    if (!parcel) throw new NotFoundException(`No pre-alert for ${externalTracking}`);
    if (parcel.lifecycleStatus !== 'PRE_ALERTED' && parcel.lifecycleStatus !== 'AWAITING_STORAGE') {
      throw new BadRequestException(`Parcel is already ${parcel.lifecycleStatus}`);
    }
    parcel.lifecycleStatus = 'STORED';
    parcel.status = 'STORED';
    if (typeof dto.weight === 'number') parcel.weight = dto.weight;
    if (typeof dto.packageCount === 'number') parcel.packageCount = dto.packageCount;
    return this.parcels.save(parcel);
  }
}
