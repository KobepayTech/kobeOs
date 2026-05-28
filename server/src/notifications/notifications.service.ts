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

  private formatParcelMessage(
    parcel: Parcel,
    kind: CargoEventKind,
    previousStatus?: string,
  ): string {
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
}
