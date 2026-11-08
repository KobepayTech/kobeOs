import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { DataSource } from 'typeorm';
import { BeemService } from '../notifications/beem.service';
import { CtzParcel } from './cargotz.entity';
import { CtzTrackingChallenge, cargoShipmentKey } from './cargotz-trip.entity';

@Injectable()
export class CargoTzTrackingAccessService {
  constructor(private readonly db: DataSource, private readonly config: ConfigService, private readonly beem: BeemService) {}

  private hash(ownerId: string, shipmentKey: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`ctz-tracking:${ownerId}:${shipmentKey}:${code}`).digest('hex');
  }

  private async ownerParcel(tracking: string, phone: string) {
    const parcel = await this.db.getRepository(CtzParcel).findOneBy({ trackingNumber: tracking.toUpperCase() });
    if (!parcel || BeemService.normalizePhone(parcel.senderPhone) !== BeemService.normalizePhone(phone)) return null;
    return parcel;
  }

  async request(tracking: string, phone: string) {
    if (!this.beem.isConfigured()) throw new ServiceUnavailableException('SMS verification is currently unavailable');
    const parcel = await this.ownerParcel(tracking, phone);
    if (!parcel) return { ok: true };
    const shipmentKey = cargoShipmentKey(parcel);
    const where = { ownerId: parcel.ownerId, shipmentKey };
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = this.hash(parcel.ownerId, shipmentKey, code);
    const created = await this.db.transaction(async (tx) => {
      const repo = tx.getRepository(CtzTrackingChallenge);
      await repo.createQueryBuilder().insert().values({ ...where }).orIgnore().execute();
      const row = await repo.findOneOrFail({ where, lock: { mode: 'pessimistic_write' } });
      if (row.sentAt && Date.now() - row.sentAt.getTime() < 60000) return false;
      // Limit repeated requests across every carton in a shipment, not just the scanned label.
      const windowStart = row.windowStart?.getTime() ?? 0;
      const sameWindow = Date.now() - windowStart < 3600000;
      if (sameWindow && row.sends >= 5) return false;
      await repo.update(row.id, {
        codeHash, sentAt: new Date(), expiresAt: new Date(Date.now() + 300000), attempts: 0,
        windowStart: sameWindow ? row.windowStart : new Date(), sends: sameWindow ? row.sends + 1 : 1,
      });
      return true;
    });
    if (!created) return { ok: true };
    const sent = await this.beem.sendSms(parcel.senderPhone, `CargoTZ tracking verification code: ${code}. Expires in 5 minutes.`, AbortSignal.timeout(8000));
    if (!sent.ok) {
      await this.db.getRepository(CtzTrackingChallenge).update({ ...where, codeHash }, { codeHash: null, expiresAt: null });
      throw new ServiceUnavailableException('SMS verification is currently unavailable');
    }
    return { ok: true };
  }

  async verify(tracking: string, phone: string, code: string) {
    const parcel = await this.ownerParcel(tracking, phone);
    if (!parcel) throw new BadRequestException('Verification code is invalid or expired');
    const shipmentKey = cargoShipmentKey(parcel);
    const valid = await this.db.transaction(async (tx) => {
      const repo = tx.getRepository(CtzTrackingChallenge);
      const row = await repo.findOne({ where: { ownerId: parcel.ownerId, shipmentKey }, lock: { mode: 'pessimistic_write' } });
      if (!row?.codeHash || !row.expiresAt || row.expiresAt.getTime() <= Date.now() || row.attempts >= 5) return false;
      const expected = this.hash(parcel.ownerId, shipmentKey, code);
      const matches = timingSafeEqual(Buffer.from(row.codeHash, 'hex'), Buffer.from(expected, 'hex'));
      await repo.update(row.id, matches ? { codeHash: null, expiresAt: null } : { attempts: row.attempts + 1 });
      return matches;
    });
    if (!valid) throw new BadRequestException('Verification code is invalid or expired');
    return {
      ownerName: parcel.senderName,
      ownerPhone: parcel.senderPhone,
      recipientName: parcel.receiverName,
      recipientPhone: parcel.receiverPhone,
      description: parcel.description,
      quantity: parcel.quantity,
      cartonCount: parcel.cartonCount,
      trackingNumber: parcel.trackingNumber,
    };
  }
}
