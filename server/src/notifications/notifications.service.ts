import { Injectable, Logger } from '@nestjs/common';
import { BeemService } from './beem.service';
import type { Parcel, Shipment } from '../cargo/cargo.entity';
import type { CargoEventKind } from '../cargo/cargo.gateway';

/**
 * Dispatches cargo events to external notification channels (SMS, WhatsApp).
 * Channel calls are best-effort — failures are logged and never block the
 * caller, so a Beem outage cannot break parcel/shipment writes.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');

  constructor(private readonly beem: BeemService) {}

  async notifyParcelEvent(
    parcel: Parcel,
    kind: CargoEventKind,
    previousStatus?: string,
  ): Promise<void> {
    const message = this.formatParcelMessage(parcel, kind, previousStatus);
    const targets = new Set<string>();
    if (parcel.senderPhone) targets.add(parcel.senderPhone);
    if (parcel.ownerPhone) targets.add(parcel.ownerPhone);

    if (targets.size === 0) return;

    await Promise.allSettled(
      Array.from(targets).flatMap((phone) => [
        this.beem.sendSms(phone, message),
        this.beem.sendWhatsApp(phone, message),
      ]),
    );
  }

  async notifyShipmentEvent(
    shipment: Shipment,
    kind: CargoEventKind,
    previousStatus?: string,
  ): Promise<void> {
    // Shipments are operational entities with no end-customer phone field on
    // the entity itself. Hook left in place for future ops-contact wiring.
    void shipment; void kind; void previousStatus;
  }

  /**
   * Customer-facing lifecycle nudge — fires SMS + WhatsApp on each
   * parcel state change (CONSOLIDATED, IN_TRANSIT, OVERSEAS_RECEIVED,
   * READY_FOR_PICKUP, DELIVERED). Kept separate from notifyParcelEvent
   * above (which is cargo-internal "created/status/assignment") so the
   * copy reads natural to a non-technical customer.
   */
  async notifyParcelLifecycle(
    parcel: Parcel,
    newStatus: string,
  ): Promise<void> {
    const phone = parcel.ownerPhone?.trim();
    if (!phone) return;
    const ref = parcel.parcelId || parcel.id;
    const trackUrl = process.env.APP_PUBLIC_URL
      ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/track/${ref}`
      : `/track/${ref}`;
    const msg = lifecycleMessage(newStatus, ref, trackUrl);
    if (!msg) return;
    await Promise.allSettled([
      this.beem.sendSms(phone, msg),
      this.beem.sendWhatsApp(phone, msg),
    ]);
  }

  private formatParcelMessage(
    parcel: Parcel,
    kind: CargoEventKind,
    previousStatus?: string,
  ): string {
    void this; // see lifecycleMessage below for the customer-facing copy
    return formatInternalMessage(parcel, kind, previousStatus);
  }
}

/** Customer-facing copy keyed by lifecycle status. Returns null for
 *  stages that don't warrant a notification (e.g. AWAITING_STORAGE
 *  fires too often; ON_HOLD is operator-only). Each message ends
 *  with the public tracking URL so the customer can deep-link. */
function lifecycleMessage(status: string, ref: string, trackUrl: string): string | null {
  switch (status) {
    case 'PRE_ALERTED':
      return `KobeCargo: We're expecting your parcel (${ref}). We'll notify you when it reaches our warehouse. Track: ${trackUrl}`;
    case 'STORED':
      return `KobeCargo: Your parcel ${ref} has arrived at our warehouse and is in storage. ${trackUrl}`;
    case 'CONSOLIDATED':
      return `KobeCargo: Your parcel ${ref} has been packed and is ready to ship. ${trackUrl}`;
    case 'IN_TRANSIT':
      return `KobeCargo: Your parcel ${ref} has been dispatched. Track it live: ${trackUrl}`;
    case 'OVERSEAS_RECEIVED':
      return `KobeCargo: Your parcel ${ref} has arrived at the destination. Customs clearance in progress. ${trackUrl}`;
    case 'READY_FOR_PICKUP':
      return `KobeCargo: Your parcel ${ref} is ready for pickup. Bring this reference + ID. ${trackUrl}`;
    case 'DELIVERED':
      return `KobeCargo: Your parcel ${ref} has been delivered. Thank you! ${trackUrl}`;
    default:
      return null;
  }
}

function formatInternalMessage(parcel: Parcel, kind: CargoEventKind, previousStatus?: string): string {
  if (kind === 'created') {
    return `KobeCargo: Parcel ${parcel.parcelId} registered for ${parcel.ownerName}. Destination: ${parcel.destination}.`;
  }
  if (kind === 'status') {
    const human = parcel.status.replace(/_/g, ' ').toLowerCase();
    return `KobeCargo: Parcel ${parcel.parcelId} update — now ${human}${
      previousStatus ? ` (was ${previousStatus.replace(/_/g, ' ').toLowerCase()})` : ''
    }.`;
  }
  return `KobeCargo: Parcel ${parcel.parcelId} updated.`;
}
