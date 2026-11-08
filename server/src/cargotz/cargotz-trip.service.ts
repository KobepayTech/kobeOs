import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { DataSource, EntityManager, In, Not, IsNull } from 'typeorm';
import { BeemService } from '../notifications/beem.service';
import { User } from '../users/user.entity';
import { CtzParcel, CtzStatus, CtzStatusEvent } from './cargotz.entity';
import { CargoTzSmsService } from './cargotz-sms.service';
import { cargoBranchKey as branchKey, cargoShipmentKey as shipmentKey, CtzOperationRole, CtzOperator, CtzPickup, CtzSmsOutbox, CtzTrip } from './cargotz-trip.entity';

const READY: CtzStatus[] = ['RECEIVED_AT_SHOP', 'AT_WAREHOUSE', 'PACKED'];
const plateKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
const phone = (raw: string) => {
  const number = BeemService.normalizePhone(raw);
  return number && /^\d{9,15}$/.test(number) ? number : null;
};

export type CtzOperationsScope = { ownerId: string; name: string; branch?: string; role: CtzOperationRole | 'Owner' };

@Injectable()
export class CargoTzTripService {
  constructor(private readonly db: DataSource, private readonly sms: CargoTzSmsService, private readonly config: ConfigService) {}

  async workspaces(accountId: string) {
    const grants = await this.db.getRepository(CtzOperator).find({ where: { accountId }, order: { branch: 'ASC', role: 'ASC' } });
    return grants.map(({ ownerId, role, branch }) => ({ ownerId, role, branch }));
  }

  async assign(ownerId: string, input: { email: string; role: CtzOperationRole; branch: string }) {
    const user = await this.db.getRepository(User).findOne({
      where: { email: input.email.trim().toLowerCase() }, select: { id: true, displayName: true },
    });
    if (!user) throw new NotFoundException('That staff member must first create a KobeOS account');
    if (user.id === ownerId) throw new BadRequestException('The company owner already has access');
    const repo = this.db.getRepository(CtzOperator);
    await repo.upsert({
      ownerId, accountId: user.id, role: input.role, branch: input.branch.trim(), branchKey: branchKey(input.branch),
      name: user.displayName || input.email.trim(),
    }, ['ownerId', 'accountId', 'role', 'branchKey']);
  }

  async staff(ownerId: string) {
    const grants = await this.db.getRepository(CtzOperator).find({ where: { ownerId }, order: { branch: 'ASC', role: 'ASC' } });
    return grants.map(({ id, role, branch, name }) => ({ id, role, branch, name }));
  }

  async revoke(ownerId: string, id: string) {
    await this.db.getRepository(CtzOperator).delete({ ownerId, id });
  }

  async scope(accountId: string, workspace: string, role: CtzOperationRole, branch?: string): Promise<CtzOperationsScope> {
    if (workspace === 'mine' || workspace === accountId) return { ownerId: accountId, name: 'Owner', role: 'Owner', branch: branch?.trim() || undefined };
    if (!branch?.trim() || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(workspace)) {
      throw new ForbiddenException('Choose your assigned cargo branch');
    }
    const grant = await this.db.getRepository(CtzOperator).findOneBy({
      ownerId: workspace, accountId, role, branchKey: branchKey(branch),
    });
    if (!grant) throw new ForbiddenException('This cargo role is unavailable at the selected branch');
    return { ownerId: workspace, role, name: grant.name, branch: grant.branch };
  }

  async ready(scope: CtzOperationsScope) {
    const query = this.db.getRepository(CtzParcel).createQueryBuilder('p')
      .where('p.ownerId = :ownerId AND p.tripId IS NULL AND p.status IN (:...states)', { ownerId: scope.ownerId, states: READY })
      .orderBy('p.createdAt', 'ASC').take(500);
    if (scope.branch) query.andWhere("LOWER(REGEXP_REPLACE(TRIM(p.origin), '[[:space:]]+', ' ', 'g')) = :branch", { branch: branchKey(scope.branch) });
    const rows = await query.getMany();
    return rows.map(({ trackingNumber, origin, destination, cartonNumber, cartonCount, weight }) =>
      ({ trackingNumber, origin, destination, cartonNumber, cartonCount, weight }));
  }

  async create(scope: CtzOperationsScope, input: {
    id: string; origin: string; plate: string; vehicleType: string; operator: string; trackingNumbers: string[];
  }) {
    const plate = plateKey(input.plate);
    if (plate.length < 4 || plate.length > 14) throw new BadRequestException('Enter a valid vehicle plate');
    if (scope.branch && branchKey(scope.branch) !== branchKey(input.origin)) throw new ForbiddenException('Choose your assigned origin');
    const refs = [...new Set(input.trackingNumbers.map((ref) => ref.toUpperCase()))];
    try {
      return await this.db.transaction(async (tx) => {
        const trips = tx.getRepository(CtzTrip);
        const existing = await trips.findOneBy({ id: input.id, ownerId: scope.ownerId });
        if (existing) {
          this.assertBranch(scope, existing.origin);
          return { id: existing.id };
        }
        const parcels = tx.getRepository(CtzParcel);
        const rows = await parcels.find({
          where: { ownerId: scope.ownerId, trackingNumber: In(refs) },
          order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' },
        });
        // A same-request retry may have committed while this transaction waited for the parcel locks.
        if (rows.length === refs.length && rows.every((row) => row.tripId === input.id)) return { id: input.id };
        if (rows.length !== refs.length || rows.some((row) =>
          row.tripId || !READY.includes(row.status) || branchKey(row.origin) !== branchKey(input.origin))) {
          throw new ConflictException('A selected carton is unavailable at this origin. Refresh the dispatch queue.');
        }
        const byReference = new Map(rows.map((row) => [row.trackingNumber, row]));
        const stops = new Map<string, CtzTrip['stops'][number]>();
        for (const ref of refs) {
          const branch = byReference.get(ref)!.destination;
          const key = branchKey(branch);
          if (!stops.has(key)) stops.set(key, { branch, key, arrivedAt: null });
        }
        if (stops.size > 20) throw new BadRequestException('A trip supports up to 20 receiving branches');
        const trip = trips.create({
          id: input.id, ownerId: scope.ownerId, origin: input.origin.trim(), plate: input.plate.trim().toUpperCase(),
          plateKey: plate, vehicleType: input.vehicleType.trim(), operator: input.operator.trim(),
          status: 'LOADING', stops: [...stops.values()],
        });
        await trips.insert(trip);
        await parcels.update({ ownerId: scope.ownerId, id: In(rows.map((row) => row.id)) }, { tripId: trip.id });
        return { id: trip.id };
      });
    } catch (cause) {
      const error = cause as { code?: string; constraint?: string };
      if (error.code === '23505' && error.constraint === 'UQ_ctz_trip_active_plate') throw new ConflictException('This plate already has an active trip');
      throw cause;
    }
  }

  async list(scope: CtzOperationsScope, role: CtzOperationRole, plate?: string) {
    const query = this.db.getRepository(CtzTrip).createQueryBuilder('t').where('t.ownerId = :uid', { uid: scope.ownerId });
    if (role === 'Destination') {
      query.andWhere("t.status IN ('LOADED','IN_TRANSIT','ARRIVED')");
      if (scope.branch) query.andWhere(
        'EXISTS (SELECT 1 FROM jsonb_array_elements(t.stops) AS stop WHERE stop->>\'key\' = :branch)', { branch: branchKey(scope.branch) },
      );
    } else if (scope.branch) {
      query.andWhere("LOWER(REGEXP_REPLACE(TRIM(t.origin), '[[:space:]]+', ' ', 'g')) = :branch", { branch: branchKey(scope.branch) });
    }
    if (plate) query.andWhere('t.plateKey = :plate', { plate: plateKey(plate) });
    const rows = await query.orderBy('t.createdAt', 'DESC').take(60).getMany();
    return rows.map((trip) => this.tripSummary(trip, role === 'Destination' ? scope.branch : undefined));
  }

  async view(scope: CtzOperationsScope, role: CtzOperationRole, id: string) {
    const trip = await this.db.getRepository(CtzTrip).findOneBy({ ownerId: scope.ownerId, id });
    if (!trip) throw new NotFoundException('Trip not found');
    if (role === 'Destination') {
      if (!['LOADED', 'IN_TRANSIT', 'ARRIVED'].includes(trip.status)) throw new NotFoundException('Trip manifest is not yet issued');
      if (scope.branch) this.stop(trip, scope.branch);
    } else this.assertBranch(scope, trip.origin);
    const rows = await this.db.getRepository(CtzParcel).find({ where: { ownerId: scope.ownerId, tripId: id }, order: { trackingNumber: 'ASC' } });
    const cartons = role === 'Destination' && scope.branch
      ? rows.filter((row) => branchKey(row.destination) === branchKey(scope.branch!))
      : rows;
    const alerts = this.db.getRepository(CtzSmsOutbox).createQueryBuilder('s')
      .select('COUNT(*) FILTER (WHERE s.sentAt IS NOT NULL)', 'sent')
      .addSelect('COUNT(*) FILTER (WHERE s.sentAt IS NULL AND s.attempts < 8)', 'pending')
      .addSelect('COUNT(*) FILTER (WHERE s.sentAt IS NULL AND s.attempts >= 8)', 'failed')
      .where('s.ownerId = :ownerId AND s.tripId = :id', { ownerId: scope.ownerId, id });
    if (role === 'Destination' && scope.branch) alerts.andWhere('s.branchKey = :branch', { branch: branchKey(scope.branch) });
    const counts = await alerts.getRawOne<{ sent: string; pending: string; failed: string }>();
    const verified = new Map<string, number>();
    if (role === 'Destination' && cartons.length) {
      const collectionIds = [...new Set(cartons.flatMap((row) => row.collectionId ? [row.collectionId] : []))];
      const singleIds = cartons.filter((row) => !row.collectionId).map((row) => row.id);
      const parcels = this.db.getRepository(CtzParcel);
      const all = await parcels.find({
        where: [
          ...(collectionIds.length ? [{ ownerId: scope.ownerId, collectionId: In(collectionIds) }] : []),
          ...(singleIds.length ? [{ ownerId: scope.ownerId, id: In(singleIds) }] : []),
        ],
        select: { id: true, collectionId: true, collectorAccessId: true, unloadedAt: true, arrivalIssue: true, destination: true },
      });
      for (const row of all) {
        if (!row.unloadedAt || row.arrivalIssue || (scope.branch && branchKey(row.destination) !== branchKey(scope.branch))) continue;
        const key = shipmentKey(row);
        verified.set(key, (verified.get(key) ?? 0) + 1);
      }
    }
    return {
      ...this.tripSummary(trip, role === 'Destination' ? scope.branch : undefined),
      cartons: cartons.map((row) => ({
        trackingNumber: row.trackingNumber, shipmentKey: shipmentKey(row), destination: row.destination,
        cartonNumber: row.cartonNumber, cartonCount: row.cartonCount, weight: row.weight,
        loadedAt: row.loadedAt, unloadedAt: row.unloadedAt, issue: row.arrivalIssue, status: row.status,
        ...(role !== 'Loading' ? { recipient: row.receiverName, recipientPhone: row.receiverPhone } : {}),
        ...(role === 'Destination' ? { shipmentVerified: verified.get(shipmentKey(row)) ?? 0 } : {}),
      })),
      sms: { configured: this.sms.configured, sent: Number(counts?.sent ?? 0), pending: Number(counts?.pending ?? 0), failed: Number(counts?.failed ?? 0) },
    };
  }

  private tripSummary(trip: CtzTrip, branch?: string) {
    const { id, origin, plate, vehicleType, operator, status, stops, sealedAt, departedAt } = trip;
    return { id, origin, plate, vehicleType, operator, status, stops: branch ? stops.filter((s) => s.key === branchKey(branch)) : stops, sealedAt, departedAt };
  }

  private assertBranch(scope: CtzOperationsScope, branch: string) {
    if (scope.branch && branchKey(scope.branch) !== branchKey(branch)) throw new ForbiddenException('This record belongs to another branch');
  }

  private stop(trip: CtzTrip, branch: string) {
    const stop = trip.stops.find((item) => item.key === branchKey(branch));
    if (!stop) throw new NotFoundException('This trip has no stop at the selected branch');
    return stop;
  }

  private tripAction(scope: CtzOperationsScope, id: string, action: (tx: EntityManager, trip: CtzTrip) => Promise<void>) {
    return this.db.transaction(async (tx) => {
      const trip = await tx.getRepository(CtzTrip).findOne({
        where: { id, ownerId: scope.ownerId }, lock: { mode: 'pessimistic_write' },
      });
      if (!trip) throw new NotFoundException('Trip not found');
      await action(tx, trip);
      return { ok: true };
    });
  }

  private async tripCarton(tx: EntityManager, trip: CtzTrip, ref: string, lock = false) {
    const parcel = await tx.getRepository(CtzParcel).findOne({
      where: { ownerId: trip.ownerId, tripId: trip.id, trackingNumber: ref.toUpperCase() },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
    if (!parcel) throw new NotFoundException('This carton is not on the trip manifest');
    return parcel;
  }

  private async transition(tx: EntityManager, rows: CtzParcel[], status: CtzStatus, actor: string, location: string) {
    if (!rows.length) return;
    await tx.getRepository(CtzParcel).update({ id: In(rows.map((p) => p.id)), ownerId: rows[0].ownerId }, { status, currentLocation: location });
    await tx.getRepository(CtzStatusEvent).insert(rows.map((row) => ({
      ownerId: row.ownerId, parcelId: row.id, status, updatedByName: actor, location,
    })));
  }

  private async notify(tx: EntityManager, trip: CtzTrip, rows: CtzParcel[], kind: 'loaded' | 'arrived' | 'ready', code?: string) {
    const shipments = new Map(rows.map((row) => [shipmentKey(row), row]));
    for (const [key, row] of shipments) {
      const recipient = phone(row.senderPhone);
      if (!recipient) continue;
      const status = kind === 'loaded' ? `loaded for ${row.destination}`
        : kind === 'arrived' ? `vehicle arrived at ${row.destination}. Wait for the pickup message`
        : `ready at ${row.destination}. Pickup code: ${code}`;
      await this.sms.enqueue(tx, {
        ownerId: trip.ownerId, tripId: trip.id, branchKey: branchKey(row.destination), phone: recipient,
        eventKey: kind === 'ready' ? `ready:${key}` : `${trip.id}:${kind}:${key}`,
        body: `CargoTZ ${row.trackingNumber}: ${status}. Track: https://cargotz.kobeapptz.com/ctz/${row.trackingNumber}`,
      });
    }
  }

  loadingScan(scope: CtzOperationsScope, id: string, ref: string, loaded: boolean) {
    return this.tripAction(scope, id, async (tx, trip) => {
      this.assertBranch(scope, trip.origin);
      if (trip.status !== 'LOADING') throw new ConflictException('This manifest is already closed for loading');
      const parcel = await this.tripCarton(tx, trip, ref);
      if (Boolean(parcel.loadedAt) === loaded) return;
      await tx.getRepository(CtzParcel).update(parcel.id, { loadedAt: loaded ? new Date() : null });
    });
  }

  seal(scope: CtzOperationsScope, id: string) {
    return this.tripAction(scope, id, async (tx, trip) => {
      this.assertBranch(scope, trip.origin);
      if (trip.sealedAt) return;
      if (trip.status !== 'LOADING') throw new ConflictException('This trip cannot be sealed');
      const rows = await tx.getRepository(CtzParcel).findBy({ ownerId: scope.ownerId, tripId: id });
      if (!rows.length || rows.some((row) => !row.loadedAt)) throw new ConflictException('Scan all assigned cartons before issuing the manifest');
      await this.transition(tx, rows, 'LOADED', scope.name, trip.origin);
      await this.notify(tx, trip, rows, 'loaded');
      await tx.getRepository(CtzTrip).update(id, { status: 'LOADED', sealedAt: new Date() });
    });
  }

  depart(scope: CtzOperationsScope, id: string) {
    return this.tripAction(scope, id, async (tx, trip) => {
      this.assertBranch(scope, trip.origin);
      if (trip.departedAt) return;
      if (trip.status !== 'LOADED') throw new ConflictException('Issue the loading manifest before departure');
      const rows = await tx.getRepository(CtzParcel).findBy({ ownerId: scope.ownerId, tripId: id });
      await this.transition(tx, rows, 'IN_TRANSIT', scope.name, trip.origin);
      await tx.getRepository(CtzTrip).update(id, { status: 'IN_TRANSIT', departedAt: new Date() });
    });
  }

  cancel(scope: CtzOperationsScope, id: string) {
    return this.tripAction(scope, id, async (tx, trip) => {
      this.assertBranch(scope, trip.origin);
      if (trip.status === 'CANCELLED') return;
      if (trip.status !== 'LOADING') throw new ConflictException('Only an unsealed trip can be cancelled');
      const parcels = tx.getRepository(CtzParcel);
      if (await parcels.countBy({ ownerId: scope.ownerId, tripId: id, loadedAt: Not(IsNull()) })) {
        throw new ConflictException('Undo loading scans after unloading the vehicle before cancelling');
      }
      await parcels.update({ ownerId: scope.ownerId, tripId: id }, { tripId: null });
      await tx.getRepository(CtzTrip).update(id, { status: 'CANCELLED' });
    });
  }

  arrive(scope: CtzOperationsScope, id: string, branch: string, plate: string) {
    return this.tripAction(scope, id, async (tx, trip) => {
      this.assertBranch(scope, branch);
      const stop = this.stop(trip, branch);
      if (trip.plateKey !== plateKey(plate)) throw new BadRequestException('The plate does not match this vehicle');
      if (stop.arrivedAt) return;
      if (trip.status !== 'IN_TRANSIT') throw new ConflictException('This trip is not in transit');
      stop.arrivedAt = new Date().toISOString();
      const rows = (await tx.getRepository(CtzParcel).findBy({ ownerId: scope.ownerId, tripId: id }))
        .filter((row) => branchKey(row.destination) === stop.key);
      await this.transition(tx, rows, 'ARRIVED', scope.name, stop.branch);
      await this.notify(tx, trip, rows, 'arrived');
      await tx.getRepository(CtzTrip).update(id, { stops: trip.stops, status: trip.stops.every((item) => item.arrivedAt) ? 'ARRIVED' : 'IN_TRANSIT' });
    });
  }

  unload(scope: CtzOperationsScope, id: string, branch: string, ref: string, result: 'RECEIVED' | 'DAMAGED' | 'MISSING' | 'EXTRA') {
    return this.tripAction(scope, id, async (tx, trip) => {
      this.assertBranch(scope, branch);
      const stop = this.stop(trip, branch);
      if (!stop.arrivedAt) throw new ConflictException('Confirm vehicle arrival before unloading');
      if (result === 'EXTRA') {
        const tracking = ref.toUpperCase();
        const assigned = await tx.getRepository(CtzParcel).findOneBy({ ownerId: scope.ownerId, tripId: id, trackingNumber: tracking });
        if (assigned && branchKey(assigned.destination) === stop.key) throw new BadRequestException('This carton is already on this branch manifest');
        const extras = stop.extraCartons ?? [];
        if (extras.includes(tracking)) return;
        if (extras.length >= 100) throw new ConflictException('This stop has reached its extra-carton report limit');
        stop.extraCartons = [...extras, tracking];
        await tx.getRepository(CtzTrip).update(id, { stops: trip.stops });
        return;
      }
      const parcel = await this.tripCarton(tx, trip, ref, true);
      if (branchKey(parcel.destination) !== stop.key) throw new BadRequestException('This carton belongs to another destination');
      if (parcel.status !== 'ARRIVED') throw new ConflictException('This carton is already released or collected');
      const issue = result === 'RECEIVED' ? '' : result;
      const received = result !== 'MISSING';
      if (Boolean(parcel.unloadedAt) === received && parcel.arrivalIssue === issue) return;
      await tx.getRepository(CtzParcel).update(parcel.id, {
        unloadedAt: received ? parcel.unloadedAt ?? new Date() : null, arrivalIssue: issue,
      });
      await tx.getRepository(CtzStatusEvent).insert({
        ownerId: scope.ownerId, parcelId: parcel.id, status: 'ARRIVED', updatedByName: scope.name, location: stop.branch,
        note: result === 'RECEIVED' ? 'Carton verified at unloading' : `Unloading exception: ${result.toLowerCase()}`,
      });
    });
  }

  private shipment(tx: EntityManager, row: CtzParcel) {
    return tx.getRepository(CtzParcel).find({
      where: row.collectionId && row.collectorAccessId
        ? { ownerId: row.ownerId, collectionId: row.collectionId, collectorAccessId: row.collectorAccessId }
        : { ownerId: row.ownerId, id: row.id },
      order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' },
    });
  }

  private codeHash(ownerId: string, key: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`ctz-pickup:${ownerId}:${key}:${code}`).digest('hex');
  }

  release(scope: CtzOperationsScope, id: string, branch: string, ref: string) {
    return this.tripAction(scope, id, async (tx, trip) => {
      this.assertBranch(scope, branch);
      const stop = this.stop(trip, branch);
      const row = await this.tripCarton(tx, trip, ref);
      if (!stop.arrivedAt || branchKey(row.destination) !== stop.key) throw new ConflictException('This shipment has not arrived at this branch');
      const rows = await this.shipment(tx, row);
      const key = shipmentKey(row);
      const repo = tx.getRepository(CtzPickup);
      if (await repo.existsBy({ ownerId: scope.ownerId, shipmentKey: key })) return;
      if (rows.length !== row.cartonCount || rows.some((parcel) =>
        branchKey(parcel.destination) !== stop.key || parcel.status !== 'ARRIVED' || !parcel.unloadedAt || parcel.arrivalIssue)) {
        throw new ConflictException('Verify every carton and resolve any exceptions before sending a pickup code');
      }
      if (!phone(row.senderPhone)) throw new BadRequestException('The saved owner phone cannot receive a pickup code');
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      await repo.insert({ ownerId: scope.ownerId, shipmentKey: key, codeHash: this.codeHash(scope.ownerId, key, code) });
      await this.transition(tx, rows, 'READY_FOR_PICKUP', scope.name, stop.branch);
      await this.notify(tx, trip, [row], 'ready', code);
    });
  }

  async collect(scope: CtzOperationsScope, id: string, branch: string, ref: string, code: string) {
    let failure: 'invalid' | 'locked' | undefined;
    const result = await this.tripAction(scope, id, async (tx, trip) => {
      this.assertBranch(scope, branch);
      const stop = this.stop(trip, branch);
      const row = await this.tripCarton(tx, trip, ref);
      if (!stop.arrivedAt || branchKey(row.destination) !== stop.key) throw new ConflictException('This shipment is not at this branch');
      const rows = await this.shipment(tx, row);
      const key = shipmentKey(row);
      const repo = tx.getRepository(CtzPickup);
      const pickup = await repo.createQueryBuilder('p').addSelect('p.codeHash').setLock('pessimistic_write')
        .where('p.ownerId = :uid AND p.shipmentKey = :key', { uid: scope.ownerId, key }).getOne();
      if (!pickup) throw new ConflictException('Release the verified shipment before customer collection');
      const matches = timingSafeEqual(Buffer.from(pickup.codeHash, 'hex'), Buffer.from(this.codeHash(scope.ownerId, key, code), 'hex'));
      if (pickup.collectedAt) {
        if (!matches) throw new ConflictException('This shipment has already been collected');
        return;
      }
      if (pickup.lockedUntil && pickup.lockedUntil.getTime() > Date.now()) { failure = 'locked'; return; }
      if (!matches) {
        const attempts = (pickup.lockedUntil ? 0 : pickup.attempts) + 1;
        await repo.update(pickup.id, { attempts, lockedUntil: attempts >= 5 ? new Date(Date.now() + 600000) : null });
        failure = 'invalid';
        return;
      }
      await this.transition(tx, rows, 'DELIVERED', scope.name, stop.branch);
      await repo.update(pickup.id, { collectedAt: new Date(), attempts: 0, lockedUntil: null });
    });
    if (failure) throw new BadRequestException(failure === 'locked' ? 'Too many attempts. Try again in 10 minutes.' : 'Pickup code is incorrect');
    return result;
  }

  retryMessages(scope: CtzOperationsScope, id: string, branch: string) {
    return this.tripAction(scope, id, async (tx, trip) => {
      this.assertBranch(scope, branch);
      const stop = this.stop(trip, branch);
      await tx.getRepository(CtzSmsOutbox).createQueryBuilder().update()
        .set({ attempts: 0, nextAttemptAt: new Date() })
        .where('"ownerId" = :ownerId AND "tripId" = :id AND "branchKey" = :branch AND "sentAt" IS NULL AND "attempts" >= 8',
          { ownerId: scope.ownerId, id, branch: stop.key }).execute();
    });
  }
}
