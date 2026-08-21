import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { JournalService } from '../erp/journal.service';
import { BeemService } from '../notifications/beem.service';
import { InboundPayment } from '../mobile-money/mobile-money.entity';
import { PaymentTransaction } from '../payments/payments.entity';
import { PlatformEventsService, PlatformNotificationService } from '../platform/platform.service';
import {
  TransitBus,
  TransitCamera,
  TransitCheckpoint,
  TransitComplianceAudit,
  TransitEnforcementAlert,
  TransitExemption,
  TransitFeeAllocation,
  TransitFeePayment,
  TransitFeePeriod,
  TransitFeePolicy,
  TransitGovernmentSettlement,
  TransitGovernmentSettlementLine,
  TransitOffRoadPeriod,
  TransitOperator,
  TransitPaymentDispute,
  TransitPlate,
  TransitPlateDetection,
  TransitRoute,
  TransitTrip,
  TransitTripStatus,
  TransitUnpaidDetection, TransitBusOperatorHistory,
  TransitTripLocationEvent,
  TransitTripFollower,
  TransitArrivalAlert,
  TransitTicket,
  TransitPassengerManifest,
  TransitVehicleCheckpointEvent,
  TransitAuthorityGrant,
} from './transit.entity';
import {
  calculateCompliance,
  displayTransitPlate,
  nextFeeWindow,
  normalizeTransitPlate,
  splitTransitFee,
  shouldAutomaticallyProcessAnpr,
  tripFollowerAlertKind,
  TransitComplianceState,
} from './transit.rules';

const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;
const code = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
const asDate = (value: string | Date) => value instanceof Date ? value : new Date(value);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

interface CreateBusInput {
  operatorId: string;
  plateNumber: string;
  name: string;
  defaultOrigin?: string;
  defaultDestination?: string;
  routeId?: string;
  conductorName?: string;
  conductorPhone?: string;
  capacity?: number;
}

interface PaymentInput {
  operatorId: string;
  busIds: string[];
  amount: number;
  method: string;
  externalReference: string;
  verificationReference: string;
  idempotencyKey: string;
}

@Injectable()
export class TransitService {
  constructor(
    private readonly ds: DataSource,
    private readonly config: ConfigService,
    private readonly journal: JournalService,
    private readonly beem: BeemService,
    private readonly events: PlatformEventsService,
    private readonly notifications: PlatformNotificationService,
  ) {}

  private repo<T extends object>(target: new () => T) {
    return this.ds.getRepository(target);
  }

  async ensurePolicy(uid: string): Promise<TransitFeePolicy> {
    const policies = this.repo(TransitFeePolicy);
    let active = await policies.findOne({ where: { ownerId: uid, active: true }, order: { effectiveAt: 'DESC' } });
    if (active) return active;
    const governmentPercent = Number(this.config.get('TRANSIT_GOVERNMENT_PERCENT', 50));
    active = policies.create({
      ownerId: uid,
      feeAmount: Number(this.config.get('TRANSIT_DEFAULT_WEEKLY_FEE', 5000)),
      currency: this.config.get('TRANSIT_FEE_CURRENCY', 'TZS'),
      periodDays: Number(this.config.get('TRANSIT_FEE_PERIOD_DAYS', 7)),
      effectiveAt: new Date(),
      graceDays: Number(this.config.get('TRANSIT_FEE_GRACE_DAYS', 2)),
      dueSoonDays: Number(this.config.get('TRANSIT_FEE_DUE_SOON_DAYS', 2)),
      governmentPercent,
      kobePercent: 100 - governmentPercent,
      automaticAnprThreshold: Number(this.config.get('TRANSIT_ANPR_THRESHOLD', 0.85)),
      enforcementRules: { createAlertWhenOverdue: true },
      exemptionRules: { approvedOnly: true },
      active: true,
    });
    return policies.save(active);
  }

  async savePolicy(uid: string, input: Partial<TransitFeePolicy>): Promise<TransitFeePolicy> {
    const feeAmount = money(input.feeAmount);
    const governmentPercent = Number(input.governmentPercent);
    const kobePercent = Number(input.kobePercent);
    if (feeAmount <= 0) throw new BadRequestException('Fee amount must be greater than zero');
    if (Math.abs(governmentPercent + kobePercent - 100) > 0.0001) {
      throw new BadRequestException('Government and Kobe percentages must total 100%');
    }
    if (Number(input.periodDays) < 1) throw new BadRequestException('Period must be at least one day');
    return this.ds.transaction(async (tx) => {
      await tx.getRepository(TransitFeePolicy).update({ ownerId: uid, active: true }, { active: false });
      return tx.getRepository(TransitFeePolicy).save(tx.getRepository(TransitFeePolicy).create({
        ownerId: uid,
        feeAmount,
        currency: String(input.currency || 'TZS').toUpperCase(),
        periodDays: Number(input.periodDays || 7),
        effectiveAt: input.effectiveAt ? asDate(input.effectiveAt) : new Date(),
        graceDays: Number(input.graceDays ?? 2),
        dueSoonDays: Number(input.dueSoonDays ?? 2),
        governmentPercent,
        kobePercent,
        automaticAnprThreshold: Number(input.automaticAnprThreshold ?? 0.85),
        enforcementRules: input.enforcementRules ?? { createAlertWhenOverdue: true },
        exemptionRules: input.exemptionRules ?? { approvedOnly: true },
        active: true,
      }));
    });
  }

  listOperators(uid: string) {
    return this.repo(TransitOperator).find({ where: { ownerId: uid }, order: { name: 'ASC' } });
  }

  async createOperator(uid: string, input: Partial<TransitOperator>) {
    if (!input.name?.trim()) throw new BadRequestException('Operator name is required');
    return this.repo(TransitOperator).save(this.repo(TransitOperator).create({
      ownerId: uid,
      name: input.name.trim(),
      registrationNumber: input.registrationNumber?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      region: input.region?.trim() ?? '',
      status: 'ACTIVE',
    }));
  }

  listRoutes(uid: string) {
    return this.repo(TransitRoute).find({ where: { ownerId: uid }, order: { name: 'ASC' } });
  }

  async createRoute(uid: string, input: Partial<TransitRoute>) {
    if (!input.code?.trim() || !input.name?.trim() || !input.origin?.trim() || !input.destination?.trim()) {
      throw new BadRequestException('Route code, name, origin and destination are required');
    }
    return this.repo(TransitRoute).save(this.repo(TransitRoute).create({
      ownerId: uid,
      code: input.code.trim().toUpperCase(), name: input.name.trim(), origin: input.origin.trim(),
      destination: input.destination.trim(), region: input.region?.trim() ?? '',
      typicalMinutes: Number(input.typicalMinutes || 0), active: true,
    }));
  }

  async createCheckpoint(uid: string, input: Partial<TransitCheckpoint>) {
    if (!input.name?.trim()) throw new BadRequestException('Checkpoint name is required');
    return this.repo(TransitCheckpoint).save(this.repo(TransitCheckpoint).create({
      ownerId: uid, routeId: input.routeId || null, name: input.name.trim(), region: input.region?.trim() ?? '',
      latitude: input.latitude?.trim() ?? '', longitude: input.longitude?.trim() ?? '',
      sequence: Number(input.sequence || 0), minutesToDestination: Number(input.minutesToDestination || 0), active: true,
    }));
  }

  listCheckpoints(uid: string) {
    return this.repo(TransitCheckpoint).find({ where: { ownerId: uid }, order: { routeId: 'ASC', sequence: 'ASC' } });
  }

  async createCamera(uid: string, input: Partial<TransitCamera>) {
    if (!input.code?.trim() || !input.name?.trim()) throw new BadRequestException('Camera code and name are required');
    const apiKey = randomBytes(32).toString('base64url');
    const camera = await this.repo(TransitCamera).save(this.repo(TransitCamera).create({
      ownerId: uid, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      checkpointId: input.checkpointId || null, location: input.location?.trim() ?? '',
      direction: input.direction ?? 'BOTH', confidenceThreshold: Number(input.confidenceThreshold ?? 0.85), active: true,
      apiKeyHash: sha256(apiKey), lastHeartbeatAt: null,
    }));
    return { camera, apiKey };
  }

  async rotateCameraKey(uid: string, id: string) {
    const camera = await this.repo(TransitCamera).findOne({ where: { ownerId: uid, id } });
    if (!camera) throw new NotFoundException('Camera not found');
    const apiKey = randomBytes(32).toString('base64url'); camera.apiKeyHash = sha256(apiKey);
    return { camera: await this.repo(TransitCamera).save(camera), apiKey };
  }

  listCameras(uid: string) {
    return this.repo(TransitCamera).find({ where: { ownerId: uid }, order: { name: 'ASC' } });
  }

  async createBus(uid: string, input: CreateBusInput) {
    const normalized = normalizeTransitPlate(input.plateNumber);
    if (normalized.length < 5) throw new BadRequestException('Enter a valid license plate');
    const operator = await this.repo(TransitOperator).findOne({ where: { ownerId: uid, id: input.operatorId } });
    if (!operator) throw new NotFoundException('Operator not found');
    if (await this.repo(TransitPlate).findOne({ where: { ownerId: uid, normalizedPlate: normalized } })) {
      throw new BadRequestException('This plate is already registered');
    }
    const policy = await this.ensurePolicy(uid);
    const result = await this.ds.transaction(async (tx) => {
      const busRepo = tx.getRepository(TransitBus);
      const bus = await busRepo.save(busRepo.create({
        ownerId: uid, operatorId: operator.id, vehicleIdentity: randomUUID(), name: input.name.trim(),
        defaultOrigin: input.defaultOrigin?.trim() ?? '', defaultDestination: input.defaultDestination?.trim() ?? '',
        routeId: input.routeId || null, conductorName: input.conductorName?.trim() ?? '',
        conductorPhone: input.conductorPhone?.trim() ?? '', capacity: Number(input.capacity || 0),
        registrationStatus: 'ACTIVE', complianceStatus: 'DUE_SOON', suspended: false,
      }));
      const plateRepo = tx.getRepository(TransitPlate);
      const plate = await plateRepo.save(plateRepo.create({
        ownerId: uid, busId: bus.id, plateNumber: displayTransitPlate(normalized), normalizedPlate: normalized,
        active: true, effectiveFrom: new Date(), effectiveTo: null,
      }));
      bus.currentPlateId = plate.id;
      bus.complianceStatus = calculateCompliance({
        now: new Date(), registeredAt: bus.createdAt ?? new Date(), policyEffectiveAt: policy.effectiveAt,
        periodDays: policy.periodDays, graceDays: policy.graceDays, dueSoonDays: policy.dueSoonDays,
      });
      await busRepo.save(bus);
      await tx.getRepository(TransitBusOperatorHistory).save(tx.getRepository(TransitBusOperatorHistory).create({ ownerId: uid, busId: bus.id, operatorId: operator.id, effectiveFrom: new Date(), effectiveTo: null, reason: 'Initial registration', changedBy: 'SYSTEM' }));
      await this.audit(tx, uid, bus.id, plate.id, 'BUS_REGISTERED', `bus:${bus.id}:registered`, '', bus.complianceStatus, `${plate.plateNumber} registered`);
      return { bus, plate };
    });
    await this.events.emit({ ownerId: uid, eventName: 'transit.bus_registered', aggregateType: 'TransitBus', aggregateId: result.bus.id, payload: { plateId: result.plate.id, plateNumber: result.plate.plateNumber } });
    return result;
  }

  async changePlate(uid: string, busId: string, plateNumber: string) {
    const normalized = normalizeTransitPlate(plateNumber);
    if (normalized.length < 5) throw new BadRequestException('Enter a valid license plate');
    return this.ds.transaction(async (tx) => {
      const buses = tx.getRepository(TransitBus);
      const plates = tx.getRepository(TransitPlate);
      const bus = await buses.findOne({ where: { ownerId: uid, id: busId } });
      if (!bus) throw new NotFoundException('Bus not found');
      if (await plates.findOne({ where: { ownerId: uid, normalizedPlate: normalized } })) throw new BadRequestException('Plate is already registered');
      const old = bus.currentPlateId ? await plates.findOne({ where: { ownerId: uid, id: bus.currentPlateId } }) : null;
      if (old) { old.active = false; old.effectiveTo = new Date(); await plates.save(old); }
      const plate = await plates.save(plates.create({
        ownerId: uid, busId: bus.id, plateNumber: displayTransitPlate(normalized), normalizedPlate: normalized,
        active: true, effectiveFrom: new Date(), effectiveTo: null, replacedPlateId: old?.id ?? null,
      }));
      bus.currentPlateId = plate.id;
      await buses.save(bus);
      await this.audit(tx, uid, bus.id, plate.id, 'PLATE_CHANGED', `plate:${plate.id}:created`, '', bus.complianceStatus, `${old?.plateNumber ?? 'No plate'} replaced by ${plate.plateNumber}`);
      return { bus, oldPlate: old, plate };
    });
  }

  async changeBusOperator(uid: string, busId: string, operatorId: string, effectiveAt: string | undefined, reason: string, actor: string) {
    const effectiveFrom = effectiveAt ? asDate(effectiveAt) : new Date();
    return this.ds.transaction(async (tx) => {
      const bus = await tx.getRepository(TransitBus).findOne({ where: { ownerId: uid, id: busId } });
      const operator = await tx.getRepository(TransitOperator).findOne({ where: { ownerId: uid, id: operatorId, status: 'ACTIVE' } });
      if (!bus || !operator) throw new NotFoundException('Bus or active operator not found');
      if (bus.operatorId === operator.id) throw new BadRequestException('Bus already belongs to this operator');
      const histories = tx.getRepository(TransitBusOperatorHistory);
      let current = await histories.findOne({ where: { ownerId: uid, busId, effectiveTo: IsNull() } });
      current ??= histories.create({ ownerId: uid, busId, operatorId: bus.operatorId, effectiveFrom: bus.createdAt, effectiveTo: null, reason: 'Backfilled historical operator', changedBy: 'SYSTEM' });
      current.effectiveTo = effectiveFrom; await histories.save(current);
      await histories.save(histories.create({ ownerId: uid, busId, operatorId: operator.id, effectiveFrom, effectiveTo: null, reason: reason?.trim() || 'Ownership/operator change', changedBy: actor }));
      const previousOperatorId = bus.operatorId; bus.operatorId = operator.id; await tx.getRepository(TransitBus).save(bus);
      await this.audit(tx, uid, bus.id, bus.currentPlateId, 'OPERATOR_CHANGED', `operator:${bus.id}:${effectiveFrom.toISOString()}`, bus.complianceStatus, bus.complianceStatus, `${previousOperatorId} changed to ${operator.id}`, { previousOperatorId, operatorId: operator.id, effectiveFrom, actor });
      return { bus, previousOperatorId, operator, effectiveFrom };
    });
  }

  async listBuses(uid: string) {
    const [buses, plates, operators] = await Promise.all([
      this.repo(TransitBus).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } }),
      this.repo(TransitPlate).find({ where: { ownerId: uid } }),
      this.repo(TransitOperator).find({ where: { ownerId: uid } }),
    ]);
    const plateById = new Map(plates.map((p) => [p.id, p]));
    const operatorById = new Map(operators.map((o) => [o.id, o]));
    return buses.map((bus) => ({ ...bus, plate: bus.currentPlateId ? plateById.get(bus.currentPlateId) ?? null : null, operator: operatorById.get(bus.operatorId) ?? null }));
  }

  async createTrip(uid: string, input: Partial<TransitTrip>) {
    if (!input.busId || !input.origin || !input.destination || !input.scheduledDeparture) throw new BadRequestException('Bus, origin, destination and departure are required');
    const bus = await this.repo(TransitBus).findOne({ where: { ownerId: uid, id: input.busId } });
    if (!bus) throw new NotFoundException('Bus not found');
    const scheduledDeparture = asDate(input.scheduledDeparture);
    const tripCode = input.tripCode?.trim().toUpperCase() || `${input.origin.slice(0, 3)}-${input.destination.slice(0, 3)}-${scheduledDeparture.toISOString().replace(/[-:T]/g, '').slice(0, 12)}`.toUpperCase();
    const trip = await this.repo(TransitTrip).save(this.repo(TransitTrip).create({
      ownerId: uid, busId: bus.id, routeId: input.routeId || bus.routeId || null, tripCode,
      origin: input.origin.trim(), destination: input.destination.trim(), scheduledDeparture,
      scheduledArrival: input.scheduledArrival ? asDate(input.scheduledArrival) : null,
      eta: input.scheduledArrival ? asDate(input.scheduledArrival) : null,
      status: input.status ?? 'SCHEDULED', gate: input.gate?.trim() ?? '', currentCheckpoint: '', delayMinutes: 0,
    }));
    await this.events.emit({ ownerId: uid, eventName: 'transit.trip_created', aggregateType: 'TransitTrip', aggregateId: trip.id, payload: { busId: trip.busId, routeId: trip.routeId } });
    return trip;
  }

  listTrips(uid: string) {
    return this.repo(TransitTrip).find({ where: { ownerId: uid }, order: { scheduledDeparture: 'DESC' }, take: 250 });
  }

  async publicBoard(uid: string) {
    const trips = await this.repo(TransitTrip).find({
      where: { ownerId: uid, status: In<TransitTripStatus>(['SCHEDULED', 'BOARDING', 'DEPARTED', 'IN_TRANSIT']) },
      order: { scheduledDeparture: 'ASC' }, take: 100,
    });
    const buses = await this.repo(TransitBus).find({ where: { ownerId: uid, id: In(trips.map((t) => t.busId)) } });
    const plates = await this.repo(TransitPlate).find({ where: { ownerId: uid, id: In(buses.map((b) => b.currentPlateId).filter(Boolean) as string[]) } });
    const busMap = new Map(buses.map((b) => [b.id, b]));
    const plateMap = new Map(plates.map((p) => [p.id, p]));
    return trips.map((trip) => {
      const bus = busMap.get(trip.busId);
      return { ...trip, busName: bus?.name ?? '', plateNumber: bus?.currentPlateId ? plateMap.get(bus.currentPlateId)?.plateNumber ?? '' : '' };
    });
  }

  private async activeExemption(tx: EntityManager, uid: string, busId: string, now: Date) {
    const official = await tx.getRepository(TransitExemption).createQueryBuilder('e')
      .where('e.ownerId = :uid AND e.busId = :busId AND e.status = :status', { uid, busId, status: 'APPROVED' })
      .andWhere('e.effectiveAt <= :now AND e.expiresAt >= :now', { now }).getOne();
    if (official) return true;
    return Boolean(await tx.getRepository(TransitOffRoadPeriod).createQueryBuilder('o')
      .where('o.ownerId = :uid AND o.busId = :busId AND o.status = :status AND o.feeTreatment = :treatment', { uid, busId, status: 'APPROVED', treatment: 'EXEMPT' })
      .andWhere('o.startsAt <= :now AND o.endsAt >= :now', { now }).getOne());
  }

  private async calculateBusStatus(tx: EntityManager, uid: string, bus: TransitBus, policy: TransitFeePolicy, now = new Date()) {
    return calculateCompliance({
      now, registeredAt: bus.createdAt, policyEffectiveAt: policy.effectiveAt,
      periodDays: policy.periodDays, graceDays: policy.graceDays, dueSoonDays: policy.dueSoonDays,
      paidThrough: bus.paidThrough, exempt: await this.activeExemption(tx, uid, bus.id, now),
      suspended: bus.suspended || bus.registrationStatus === 'SUSPENDED',
    });
  }

  private audit(
    tx: EntityManager, uid: string, busId: string, plateId: string | null | undefined,
    eventType: string, eventKey: string, fromStatus: string, toStatus: string,
    message: string, metadata: Record<string, unknown> = {},
  ) {
    const repo = tx.getRepository(TransitComplianceAudit);
    return repo.save(repo.create({ ownerId: uid, busId, plateId: plateId || null, eventType, eventKey, fromStatus, toStatus, message, metadata }));
  }

  async recordVerifiedPayment(uid: string, input: PaymentInput) {
    if (!input.verificationReference?.trim()) throw new BadRequestException('Payment verification reference is required');
    if (!input.idempotencyKey?.trim() || !input.externalReference?.trim()) throw new BadRequestException('Payment references are required');
    const busIds = [...new Set(input.busIds || [])];
    if (!busIds.length) throw new BadRequestException('Select at least one bus');
    const policy = await this.ensurePolicy(uid);
    const expected = money(Number(policy.feeAmount) * busIds.length);
    if (money(input.amount) !== expected) throw new BadRequestException(`Expected ${expected} ${policy.currency} for ${busIds.length} bus(es)`);

    const result = await this.ds.transaction(async (tx) => {
      const paymentRepo = tx.getRepository(TransitFeePayment);
      const existing = await paymentRepo.findOne({ where: { ownerId: uid, idempotencyKey: input.idempotencyKey.trim() } });
      if (existing) return { payment: existing, allocations: await tx.getRepository(TransitFeeAllocation).find({ where: { ownerId: uid, paymentId: existing.id } }), idempotent: true };
      if (await paymentRepo.findOne({ where: { ownerId: uid, externalReference: input.externalReference.trim() } })) {
        throw new BadRequestException('This provider transaction has already been used');
      }
      let inbound: InboundPayment | null = null;
      if (input.method === 'MOBILE_MONEY' || input.method === 'BANK') {
        inbound = await tx.getRepository(InboundPayment).createQueryBuilder('payment')
          .setLock('pessimistic_write')
          .where('payment.ownerId = :uid AND payment.transactionId = :reference AND payment.direction = :direction', {
            uid, reference: input.externalReference.trim(), direction: 'RECEIVED',
          }).getOne();
        if (!inbound) throw new BadRequestException('No verified inbound bank/mobile-money transaction matches this reference');
        if (money(inbound.amount) !== expected || inbound.currency !== policy.currency) {
          throw new BadRequestException('Inbound payment amount or currency does not match the fleet fee');
        }
        if (inbound.consumedBy && inbound.consumedBy !== 'transit') throw new BadRequestException('This inbound payment was already allocated to another module');
      } else if (input.method === 'KOBEPAY') {
        const walletPayment = await tx.getRepository(PaymentTransaction).findOne({
          where: { ownerId: uid, reference: input.externalReference.trim(), status: 'COMPLETED', type: 'CREDIT' },
        });
        if (!walletPayment || money(walletPayment.amount) !== expected || walletPayment.currency !== policy.currency) {
          throw new BadRequestException('No completed KobePay credit matches this reference, amount and currency');
        }
      } else if (!input.verificationReference.trim().toUpperCase().startsWith('AUTH-')) {
        throw new BadRequestException('Other payment rails require an authorized verification reference beginning AUTH-');
      }
      const operator = await tx.getRepository(TransitOperator).findOne({ where: { ownerId: uid, id: input.operatorId } });
      if (!operator) throw new NotFoundException('Operator not found');
      const buses = await tx.getRepository(TransitBus).createQueryBuilder('bus')
        .setLock('pessimistic_write')
        .where('bus.ownerId = :uid AND bus.id IN (:...busIds)', { uid, busIds }).getMany();
      if (buses.length !== busIds.length || buses.some((bus) => bus.operatorId !== operator.id)) throw new BadRequestException('Every selected bus must belong to this operator');
      const currentPlates = await tx.getRepository(TransitPlate).find({ where: { ownerId: uid, id: In(buses.map((b) => b.currentPlateId).filter(Boolean) as string[]) } });
      if (currentPlates.length !== buses.length) throw new BadRequestException('Every selected bus must have an active plate');

      const paymentReference = code('TRF');
      const payment = await paymentRepo.save(paymentRepo.create({
        ownerId: uid, operatorId: operator.id, amount: expected, currency: policy.currency,
        method: input.method, externalReference: input.externalReference.trim(),
        verificationReference: input.verificationReference.trim(), paymentReference,
        receiptNumber: code('TRR'), idempotencyKey: input.idempotencyKey.trim(), verified: true,
        verifiedAt: new Date(), busCount: buses.length, status: 'VERIFIED',
      }));
      if (inbound) {
        inbound.consumedBy = 'transit';
        inbound.consumedRef = payment.paymentReference;
        inbound.status = 'PROCESSED';
        await tx.getRepository(InboundPayment).save(inbound);
      }

      const allocationRepo = tx.getRepository(TransitFeeAllocation);
      const periodRepo = tx.getRepository(TransitFeePeriod);
      const split = splitTransitFee(Number(policy.feeAmount), Number(policy.governmentPercent), Number(policy.kobePercent));
      const allocations: TransitFeeAllocation[] = [];
      for (const bus of buses) {
        const plate = currentPlates.find((item) => item.id === bus.currentPlateId)!;
        const window = nextFeeWindow(policy.effectiveAt, policy.periodDays, new Date(), bus.paidThrough);
        let period = await periodRepo.findOne({ where: { ownerId: uid, busId: bus.id, periodStart: window.start } });
        if (!period) period = periodRepo.create({ ownerId: uid, busId: bus.id, plateId: plate.id, policyId: policy.id, periodStart: window.start, periodEnd: window.end, dueAt: window.dueAt, amountDue: policy.feeAmount, amountPaid: 0, status: 'DUE_SOON' });
        period.plateId = plate.id; period.paymentId = payment.id; period.paidAt = new Date();
        period.amountPaid = policy.feeAmount; period.status = 'PAID';
        period = await periodRepo.save(period);
        const allocation = await allocationRepo.save(allocationRepo.create({
          ownerId: uid, paymentId: payment.id, feePeriodId: period.id, busId: bus.id, plateId: plate.id,
          grossAmount: policy.feeAmount, governmentAmount: split.governmentAmount, kobeAmount: split.kobeAmount,
          processingFee: 0, settlementStatus: 'ACCRUED',
        }));
        allocations.push(allocation);
        const previous = bus.complianceStatus;
        bus.paidThrough = window.end; bus.complianceStatus = 'PAID';
        await tx.getRepository(TransitBus).save(bus);
        await this.resolveAlerts(tx, uid, bus.id, payment.paymentReference);
        await this.audit(tx, uid, bus.id, plate.id, 'FEE_PAID', `payment:${payment.id}:${bus.id}`, previous, 'PAID', `${plate.plateNumber} paid through ${window.end.toISOString()}`, { paymentId: payment.id, paymentReference });
      }
      const governmentTotal = money(split.governmentAmount * buses.length);
      const kobeTotal = money(split.kobeAmount * buses.length);
      await this.journal.postTransitFeePaymentInTransaction(tx, uid, { grossAmount: expected, governmentAmount: governmentTotal, kobeAmount: kobeTotal, reference: payment.paymentReference });
      return { payment, allocations, idempotent: false };
    });
    if (!result.idempotent) {
      await this.events.emit({ ownerId: uid, eventName: 'transit.fee_paid', aggregateType: 'TransitFeePayment', aggregateId: result.payment.id, payload: { amount: result.payment.amount, busCount: result.payment.busCount, paymentReference: result.payment.paymentReference } });
      await this.events.emit({ ownerId: uid, eventName: 'transit.government_share_accrued', aggregateType: 'TransitFeePayment', aggregateId: result.payment.id, payload: { governmentAmount: result.allocations.reduce((sum, row) => sum + Number(row.governmentAmount), 0) } });
    }
    return result;
  }

  private async resolveAlerts(tx: EntityManager, uid: string, busId: string, paymentReference: string) {
    const now = new Date();
    const detections = await tx.getRepository(TransitUnpaidDetection).find({ where: { ownerId: uid, busId, status: 'OPEN' } });
    for (const detection of detections) { detection.status = 'RESOLVED'; detection.resolvedAt = now; }
    if (detections.length) await tx.getRepository(TransitUnpaidDetection).save(detections);
    const alerts = await tx.getRepository(TransitEnforcementAlert).find({ where: { ownerId: uid, busId, status: 'OPEN' } });
    for (const alert of alerts) { alert.status = 'RESOLVED'; alert.resolvedAt = now; alert.resolutionNote = `Compliance restored by ${paymentReference}`; }
    if (alerts.length) await tx.getRepository(TransitEnforcementAlert).save(alerts);
  }

  async recordDetection(uid: string, input: { cameraId: string; plateNumber: string; confidence: number; direction?: string; imageUrl?: string; detectedAt?: string }) {
    const policy = await this.ensurePolicy(uid);
    const result = await this.ds.transaction(async (tx) => {
      const camera = await tx.getRepository(TransitCamera).findOne({ where: { ownerId: uid, id: input.cameraId, active: true } });
      if (!camera) throw new NotFoundException('Active camera not found');
      const normalizedPlate = normalizeTransitPlate(input.plateNumber);
      const plate = await tx.getRepository(TransitPlate).findOne({ where: { ownerId: uid, normalizedPlate, active: true } });
      const automatic = shouldAutomaticallyProcessAnpr(Number(input.confidence), camera.confidenceThreshold, policy.automaticAnprThreshold, Boolean(plate));
      const checkpoint = camera.checkpointId ? await tx.getRepository(TransitCheckpoint).findOne({ where: { ownerId: uid, id: camera.checkpointId } }) : null;
      const detectionRepo = tx.getRepository(TransitPlateDetection);
      const detection = await detectionRepo.save(detectionRepo.create({
        ownerId: uid, observedPlate: displayTransitPlate(input.plateNumber), normalizedPlate, cameraId: camera.id,
        checkpointId: checkpoint?.id ?? null, busId: plate?.busId ?? null, confidence: Number(input.confidence),
        direction: input.direction || camera.direction, imageUrl: input.imageUrl?.trim() ?? '',
        detectedAt: input.detectedAt ? new Date(input.detectedAt) : new Date(), reviewStatus: automatic ? 'AUTOMATIC' : 'MANUAL_REVIEW',
      }));
      if (!automatic || !plate) return { detection, action: 'MANUAL_REVIEW', alert: null };
      const bus = await tx.getRepository(TransitBus).findOne({ where: { ownerId: uid, id: plate.busId } });
      if (!bus) return { detection, action: 'MANUAL_REVIEW', alert: null };
      const previous = bus.complianceStatus;
      const compliance = await this.calculateBusStatus(tx, uid, bus, policy, detection.detectedAt);
      bus.complianceStatus = compliance; bus.currentLocation = checkpoint?.name || camera.location; bus.lastSeenAt = detection.detectedAt;
      await tx.getRepository(TransitBus).save(bus);
      detection.complianceStatus = compliance;

      const trip = await tx.getRepository(TransitTrip).findOne({
        where: { ownerId: uid, busId: bus.id, status: In<TransitTripStatus>(['SCHEDULED', 'BOARDING', 'DEPARTED', 'IN_TRANSIT']) },
        order: { scheduledDeparture: 'ASC' },
      });
      if (trip) {
        detection.tripId = trip.id; trip.currentCheckpoint = checkpoint?.name || camera.location;
        const direction = (input.direction || camera.direction).toUpperCase();
        if (!trip.actualDeparture && direction === 'EXIT') {
          trip.actualDeparture = detection.detectedAt; trip.status = 'DEPARTED';
          trip.delayMinutes = Math.max(0, Math.round((trip.actualDeparture.getTime() - trip.scheduledDeparture.getTime()) / 60_000));
          if (trip.scheduledArrival) trip.eta = new Date(trip.scheduledArrival.getTime() + trip.delayMinutes * 60_000);
        } else if (trip.actualDeparture) {
          trip.status = 'IN_TRANSIT';
          if (checkpoint && checkpoint.minutesToDestination >= 0) trip.eta = new Date(detection.detectedAt.getTime() + checkpoint.minutesToDestination * 60_000);
        }
        if (checkpoint?.minutesToDestination === 0 && direction === 'ENTRY') { trip.status = 'ARRIVED'; trip.actualArrival = detection.detectedAt; trip.eta = detection.detectedAt; }
        await tx.getRepository(TransitTrip).save(trip);
      }
      await detectionRepo.save(detection);
      if (previous !== compliance) await this.audit(tx, uid, bus.id, plate.id, 'COMPLIANCE_CHANGED', `detection:${detection.id}:status`, previous, compliance, `${plate.plateNumber} changed from ${previous} to ${compliance}`);
      if (compliance !== 'OVERDUE') return { detection, action: 'TRACKED', alert: null };

      const unpaidRepo = tx.getRepository(TransitUnpaidDetection);
      const unpaid = await unpaidRepo.save(unpaidRepo.create({
        ownerId: uid, detectionId: detection.id, busId: bus.id, plateId: plate.id, policyId: policy.id,
        outstandingAmount: policy.feeAmount, checkpointName: checkpoint?.name || camera.location,
        imageUrl: detection.imageUrl, status: 'OPEN',
      }));
      const operator = await tx.getRepository(TransitOperator).findOne({ where: { ownerId: uid, id: bus.operatorId } });
      const alertRepo = tx.getRepository(TransitEnforcementAlert);
      const message = `UNPAID BUS DETECTED — ${plate.plateNumber}, ${operator?.name ?? 'Unknown operator'}, ${policy.currency} ${money(policy.feeAmount).toLocaleString()} due at ${unpaid.checkpointName}`;
      const alert = await alertRepo.save(alertRepo.create({
        ownerId: uid, unpaidDetectionId: unpaid.id, detectionId: detection.id, busId: bus.id,
        plateId: plate.id, destination: 'TRAFFIC_GOVERNMENT_DASHBOARD', message, status: 'OPEN',
      }));
      await this.audit(tx, uid, bus.id, plate.id, 'ENFORCEMENT_ALERT_CREATED', `alert:${alert.id}`, compliance, compliance, message, { detectionId: detection.id, imageUrl: detection.imageUrl });
      return { detection, action: 'OVERDUE_ALERT', alert, operatorPhone: operator?.phone ?? '', message };
    });
    if ('operatorPhone' in result && result.operatorPhone) await Promise.allSettled([this.beem.sendSms(result.operatorPhone, result.message)]);
    await this.events.emit({ ownerId: uid, eventName: 'transit.plate_detected', aggregateType: 'TransitPlateDetection', aggregateId: result.detection.id, payload: { plate: result.detection.observedPlate, confidence: result.detection.confidence, action: result.action } });
    if (result.detection.tripId) await this.notifyTripFollowers(uid, result.detection.tripId, result.detection.id);
    if (result.action === 'OVERDUE_ALERT' && result.alert) {
      await this.events.emit({ ownerId: uid, eventName: 'transit.unpaid_bus_detected', aggregateType: 'TransitPlateDetection', aggregateId: result.detection.id, payload: { alertId: result.alert.id, busId: result.detection.busId, imageUrl: result.detection.imageUrl } });
      await this.events.emit({ ownerId: uid, eventName: 'transit.enforcement_alert_created', aggregateType: 'TransitEnforcementAlert', aggregateId: result.alert.id, payload: { detectionId: result.detection.id } });
      await this.dispatchEnforcementWebhook(policy, result.alert, result.detection);
    }
    return result;
  }

  async listDetections(uid: string, reviewStatus?: string) {
    const where = reviewStatus ? { ownerId: uid, reviewStatus: reviewStatus as TransitPlateDetection['reviewStatus'] } : { ownerId: uid };
    return this.repo(TransitPlateDetection).find({ where, order: { detectedAt: 'DESC' }, take: 300 });
  }

  async reviewDetection(uid: string, id: string, input: { status: 'CONFIRMED' | 'REJECTED'; plateNumber?: string }) {
    const detection = await this.repo(TransitPlateDetection).findOne({ where: { ownerId: uid, id } });
    if (!detection) throw new NotFoundException('Detection not found');
    if (input.status === 'REJECTED') { detection.reviewStatus = 'REJECTED'; return this.repo(TransitPlateDetection).save(detection); }
    if (!input.plateNumber) throw new BadRequestException('Confirmed plate is required');
    detection.observedPlate = displayTransitPlate(input.plateNumber); detection.normalizedPlate = normalizeTransitPlate(input.plateNumber); detection.reviewStatus = 'CONFIRMED';
    await this.repo(TransitPlateDetection).save(detection);
    const processed = await this.recordDetection(uid, { cameraId: detection.cameraId, plateNumber: input.plateNumber, confidence: 1, direction: detection.direction, imageUrl: detection.imageUrl, detectedAt: detection.detectedAt.toISOString() });
    return { reviewedDetection: detection, processed };
  }

  async refreshComplianceForOwner(uid: string) {
    const policy = await this.ensurePolicy(uid);
    const notifications: Array<{ phone: string; message: string }> = [];
    const complianceEvents: Array<{ busId: string; plateId: string | null; previous: TransitComplianceState; next: TransitComplianceState }> = [];
    const feeEvents: Array<{ busId: string; plateId: string | null; state: 'DUE_SOON' | 'OVERDUE' }> = [];
    const changed = await this.ds.transaction(async (tx) => {
      const buses = await tx.getRepository(TransitBus).find({ where: { ownerId: uid, registrationStatus: In(['ACTIVE', 'SUSPENDED']) } });
      const plates = await tx.getRepository(TransitPlate).find({ where: { ownerId: uid, active: true } });
      const operators = await tx.getRepository(TransitOperator).find({ where: { ownerId: uid } });
      const dayKey = new Date().toISOString().slice(0, 10);
      let count = 0;
      for (const bus of buses) {
        const next = await this.calculateBusStatus(tx, uid, bus, policy);
        const previous = bus.complianceStatus;
        if (previous !== next) {
          bus.complianceStatus = next; await tx.getRepository(TransitBus).save(bus); count++;
          await this.audit(tx, uid, bus.id, bus.currentPlateId, 'COMPLIANCE_CHANGED', `status:${bus.id}:${dayKey}:${next}`, previous, next, `Compliance changed from ${previous} to ${next}`);
          complianceEvents.push({ busId: bus.id, plateId: bus.currentPlateId ?? null, previous, next });
        }
        if (next === 'DUE_SOON' || next === 'OVERDUE') {
          const key = `reminder:${bus.id}:${dayKey}:${next}`;
          if (!await tx.getRepository(TransitComplianceAudit).findOne({ where: { ownerId: uid, eventKey: key } })) {
            const plate = plates.find((item) => item.id === bus.currentPlateId);
            const message = next === 'OVERDUE'
              ? `${plate?.plateNumber ?? bus.name} is overdue. Its Transit compliance status is now OVERDUE.`
              : `Transit fee for ${plate?.plateNumber ?? bus.name} is due soon.`;
            await this.audit(tx, uid, bus.id, bus.currentPlateId, 'PAYMENT_REMINDER', key, next, next, message);
            feeEvents.push({ busId: bus.id, plateId: bus.currentPlateId ?? null, state: next });
            const operator = operators.find((item) => item.id === bus.operatorId);
            if (operator?.phone) notifications.push({ phone: operator.phone, message });
          }
        }
      }
      return count;
    });
    await Promise.allSettled(notifications.map((item) => this.beem.sendSms(item.phone, item.message)));
    for (const event of complianceEvents) {
      await this.events.emit({ ownerId: uid, eventName: 'transit.compliance_changed', aggregateType: 'TransitBus', aggregateId: event.busId, payload: { plateId: event.plateId, previous: event.previous, next: event.next } });
    }
    for (const event of feeEvents) {
      await this.events.emit({ ownerId: uid, eventName: event.state === 'OVERDUE' ? 'transit.fee_overdue' : 'transit.fee_due', aggregateType: 'TransitBus', aggregateId: event.busId, payload: { plateId: event.plateId, state: event.state } });
    }
    return { changed, reminders: notifications.length };
  }

  @Cron('0 8 * * *')
  async refreshAllCompliance() {
    const owners = await this.repo(TransitBus).createQueryBuilder('b').select('DISTINCT b.ownerId', 'ownerId').getRawMany<{ ownerId: string }>();
    for (const { ownerId } of owners) await this.refreshComplianceForOwner(ownerId);
  }

  async dashboard(uid: string) {
    await this.refreshComplianceForOwner(uid);
    const [policy, buses, operators, payments, allocations, alerts, detections, settlements] = await Promise.all([
      this.ensurePolicy(uid), this.listBuses(uid), this.listOperators(uid),
      this.repo(TransitFeePayment).find({ where: { ownerId: uid, status: 'VERIFIED' }, order: { createdAt: 'DESC' }, take: 1000 }),
      this.repo(TransitFeeAllocation).find({ where: { ownerId: uid }, take: 10000 }),
      this.repo(TransitEnforcementAlert).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 100 }),
      this.repo(TransitPlateDetection).find({ where: { ownerId: uid }, order: { detectedAt: 'DESC' }, take: 100 }),
      this.repo(TransitGovernmentSettlement).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 100 }),
    ]);
    const count = (state: TransitComplianceState) => buses.filter((bus) => bus.complianceStatus === state).length;
    return {
      ownerId: uid, policy, operators, buses,
      metrics: {
        registeredBuses: buses.length, paid: count('PAID'), dueSoon: count('DUE_SOON'),
        gracePeriod: count('GRACE_PERIOD'), overdue: count('OVERDUE'), exempt: count('EXEMPT'), suspended: count('SUSPENDED'),
        weeklyExpected: money(buses.length * Number(policy.feeAmount)),
        grossCollected: money(payments.reduce((sum, row) => sum + Number(row.amount), 0)),
        governmentAccrued: money(allocations.reduce((sum, row) => sum + Number(row.governmentAmount), 0)),
        kobeRevenue: money(allocations.reduce((sum, row) => sum + Number(row.kobeAmount), 0)),
        governmentOutstanding: money(allocations.filter((row) => !['SETTLED', 'RECONCILED'].includes(row.settlementStatus)).reduce((sum, row) => sum + Number(row.governmentAmount), 0)),
        openAlerts: alerts.filter((row) => row.status === 'OPEN').length,
        manualReview: detections.filter((row) => row.reviewStatus === 'MANUAL_REVIEW').length,
      },
      recentPayments: payments.slice(0, 12), recentAlerts: alerts.slice(0, 12), recentDetections: detections.slice(0, 12), settlements,
    };
  }

  async governmentOverview(uid: string, filters: { status?: string; operatorId?: string; plate?: string; method?: string; from?: string; to?: string; routeId?: string; region?: string; terminal?: string; busId?: string; week?: string; month?: string }) {
    const dashboard = await this.dashboard(uid);
    let buses = dashboard.buses;
    if (filters.status) buses = buses.filter((row) => row.complianceStatus === filters.status);
    if (filters.operatorId) buses = buses.filter((row) => row.operatorId === filters.operatorId);
    if (filters.busId) buses = buses.filter((row) => row.id === filters.busId);
    if (filters.routeId) buses = buses.filter((row) => row.routeId === filters.routeId);
    if (filters.region) buses = buses.filter((row) => String(row.operator?.region ?? '').toLowerCase().includes(filters.region!.toLowerCase()));
    if (filters.terminal) buses = buses.filter((row) => `${row.defaultOrigin} ${row.defaultDestination} ${row.currentLocation}`.toLowerCase().includes(filters.terminal!.toLowerCase()));
    if (filters.plate) { const q = normalizeTransitPlate(filters.plate); buses = buses.filter((row) => row.plate?.normalizedPlate.includes(q)); }
    let payments = await this.repo(TransitFeePayment).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 5000 });
    if (filters.method) payments = payments.filter((row) => row.method === filters.method);
    let periodFrom = filters.from; let periodTo = filters.to;
    if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) { periodFrom = `${filters.month}-01`; const end = new Date(`${periodFrom}T00:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0); periodTo = end.toISOString(); }
    if (filters.week && /^\d{4}-W\d{2}$/.test(filters.week)) { const [year, week] = filters.week.split('-W').map(Number); const start = new Date(Date.UTC(year, 0, 4)); start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) + (week - 1) * 7); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7); periodFrom = start.toISOString(); periodTo = end.toISOString(); }
    if (periodFrom) payments = payments.filter((row) => new Date(row.createdAt) >= new Date(periodFrom!));
    if (periodTo) payments = payments.filter((row) => new Date(row.createdAt) <= new Date(periodTo!));
    const paymentIds = payments.map((payment) => payment.id); const allocations = paymentIds.length ? await this.repo(TransitFeeAllocation).find({ where: { ownerId: uid, paymentId: In(paymentIds) } }) : [];
    return { ...dashboard, buses, recentPayments: payments.slice(0, 100), filteredSummary: { buses: buses.length, grossFees: money(payments.reduce((sum, payment) => sum + Number(payment.amount), 0)), governmentShare: money(allocations.reduce((sum, allocation) => sum + Number(allocation.governmentAmount), 0)), kobeShare: money(allocations.reduce((sum, allocation) => sum + Number(allocation.kobeAmount), 0)), payments: payments.length }, appliedFilters: filters };
  }

  async plateDrilldown(uid: string, plateNumber: string) {
    const plate = await this.repo(TransitPlate).findOne({ where: { ownerId: uid, normalizedPlate: normalizeTransitPlate(plateNumber) } });
    if (!plate) throw new NotFoundException('Plate not found');
    const bus = await this.repo(TransitBus).findOne({ where: { ownerId: uid, id: plate.busId } });
    if (!bus) throw new NotFoundException('Bus not found');
    const [operator, periods, allocations, detections, alerts, audit, plateHistory, operatorHistory] = await Promise.all([
      this.repo(TransitOperator).findOne({ where: { ownerId: uid, id: bus.operatorId } }),
      this.repo(TransitFeePeriod).find({ where: { ownerId: uid, busId: bus.id }, order: { periodStart: 'DESC' } }),
      this.repo(TransitFeeAllocation).find({ where: { ownerId: uid, busId: bus.id }, order: { createdAt: 'DESC' } }),
      this.repo(TransitPlateDetection).find({ where: { ownerId: uid, busId: bus.id }, order: { detectedAt: 'DESC' }, take: 250 }),
      this.repo(TransitEnforcementAlert).find({ where: { ownerId: uid, busId: bus.id }, order: { createdAt: 'DESC' } }),
      this.repo(TransitComplianceAudit).find({ where: { ownerId: uid, busId: bus.id }, order: { createdAt: 'DESC' } }),
      this.repo(TransitPlate).find({ where: { ownerId: uid, busId: bus.id }, order: { effectiveFrom: 'DESC' } }),
      this.repo(TransitBusOperatorHistory).find({ where: { ownerId: uid, busId: bus.id }, order: { effectiveFrom: 'DESC' } }),
    ]);
    const paymentIds = [...new Set(allocations.map((row) => row.paymentId))];
    const payments = paymentIds.length ? await this.repo(TransitFeePayment).find({ where: { ownerId: uid, id: In(paymentIds) }, order: { createdAt: 'DESC' } }) : [];
    return { plate, plateHistory, operatorHistory, bus, operator, compliance: bus.complianceStatus, periods, payments, allocations, detections, alerts, audit };
  }

  async createSettlement(uid: string, input: { periodStart: string; periodEnd: string }) {
    const periodStart = new Date(input.periodStart); const periodEnd = new Date(input.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd < periodStart) throw new BadRequestException('Enter a valid settlement period');
    const settlement = await this.ds.transaction(async (tx) => {
      const allocations = await tx.getRepository(TransitFeeAllocation).createQueryBuilder('a')
        .setLock('pessimistic_write')
        .where('a.ownerId = :uid AND a.settlementStatus = :status', { uid, status: 'ACCRUED' })
        .andWhere('a.createdAt >= :start AND a.createdAt <= :end', { start: periodStart, end: periodEnd }).getMany();
      if (!allocations.length) throw new BadRequestException('No accrued allocations in this period');
      const grossAmount = money(allocations.reduce((sum, row) => sum + Number(row.grossAmount), 0));
      const governmentAmount = money(allocations.reduce((sum, row) => sum + Number(row.governmentAmount), 0));
      const kobeAmount = money(allocations.reduce((sum, row) => sum + Number(row.kobeAmount), 0));
      const repo = tx.getRepository(TransitGovernmentSettlement);
      const settlement = await repo.save(repo.create({ ownerId: uid, settlementReference: code('TGS'), periodStart, periodEnd, grossAmount, governmentAmount, kobeAmount, processingFees: 0, settledAmount: 0, status: 'PENDING' }));
      const lineRepo = tx.getRepository(TransitGovernmentSettlementLine);
      await lineRepo.save(allocations.map((row) => lineRepo.create({ ownerId: uid, settlementId: settlement.id, allocationId: row.id, paymentId: row.paymentId, busId: row.busId, plateId: row.plateId, governmentAmount: row.governmentAmount })));
      for (const allocation of allocations) { allocation.settlementId = settlement.id; allocation.settlementStatus = 'PENDING'; }
      await tx.getRepository(TransitFeeAllocation).save(allocations);
      return settlement;
    });
    await this.events.emit({ ownerId: uid, eventName: 'transit.government_settlement_created', aggregateType: 'TransitGovernmentSettlement', aggregateId: settlement.id, payload: { settlementReference: settlement.settlementReference, governmentAmount: settlement.governmentAmount, periodStart: settlement.periodStart, periodEnd: settlement.periodEnd } });
    return settlement;
  }

  listSettlements(uid: string) {
    return this.repo(TransitGovernmentSettlement).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  async settle(uid: string, id: string, input: { paymentReference: string; settledAmount?: number }) {
    if (!input.paymentReference?.trim()) throw new BadRequestException('Government payment reference is required');
    const settlement = await this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(TransitGovernmentSettlement);
      const settlement = await repo.findOne({ where: { ownerId: uid, id } });
      if (!settlement) throw new NotFoundException('Settlement not found');
      if (!['PENDING', 'ACCRUED'].includes(settlement.status)) throw new BadRequestException('Settlement is not pending');
      const settledAmount = money(input.settledAmount ?? settlement.governmentAmount);
      if (settledAmount !== money(settlement.governmentAmount)) throw new BadRequestException('Settlement amount must equal the government payable; use a dispute for differences');
      settlement.status = 'SETTLED'; settlement.settledAmount = settledAmount;
      settlement.paymentReference = input.paymentReference.trim(); settlement.settledAt = new Date();
      await repo.save(settlement);
      const allocations = await tx.getRepository(TransitFeeAllocation).find({ where: { ownerId: uid, settlementId: settlement.id } });
      for (const allocation of allocations) allocation.settlementStatus = 'SETTLED';
      await tx.getRepository(TransitFeeAllocation).save(allocations);
      await this.journal.postTransitGovernmentSettlementInTransaction(tx, uid, settledAmount, settlement.settlementReference);
      return settlement;
    });
    await this.events.emit({ ownerId: uid, eventName: 'transit.government_settlement_completed', aggregateType: 'TransitGovernmentSettlement', aggregateId: settlement.id, payload: { settlementReference: settlement.settlementReference, settledAmount: settlement.settledAmount, paymentReference: settlement.paymentReference } });
    return settlement;
  }

  async reconcileSettlement(uid: string, id: string, note = '') {
    return this.ds.transaction(async (tx) => {
      const repo = tx.getRepository(TransitGovernmentSettlement);
      const settlement = await repo.findOne({ where: { ownerId: uid, id } });
      if (!settlement) throw new NotFoundException('Settlement not found');
      if (settlement.status !== 'SETTLED') throw new BadRequestException('Only a settled batch can be reconciled');
      settlement.status = 'RECONCILED'; settlement.reconciledAt = new Date(); settlement.reconciliationNote = note;
      await repo.save(settlement);
      const allocations = await tx.getRepository(TransitFeeAllocation).find({ where: { ownerId: uid, settlementId: settlement.id } });
      for (const allocation of allocations) allocation.settlementStatus = 'RECONCILED';
      await tx.getRepository(TransitFeeAllocation).save(allocations);
      return settlement;
    });
  }

  async createExemption(uid: string, input: Partial<TransitExemption>, actor: string) {
    if (!input.busId || !input.exemptionType || !input.authority || !input.reason || !input.effectiveAt || !input.expiresAt) throw new BadRequestException('Bus, type, authority, reason and dates are required');
    if (!await this.repo(TransitBus).findOne({ where: { ownerId: uid, id: input.busId } })) throw new NotFoundException('Bus not found');
    const exemption = await this.repo(TransitExemption).save(this.repo(TransitExemption).create({
      ownerId: uid, busId: input.busId, exemptionType: input.exemptionType, authority: input.authority,
      reason: input.reason, effectiveAt: asDate(input.effectiveAt), expiresAt: asDate(input.expiresAt),
      supportingDocumentUrl: input.supportingDocumentUrl ?? '', createdBy: actor, approvedBy: '', status: 'PENDING',
    }));
    await this.events.emit({ ownerId: uid, eventName: 'transit.exemption_created', aggregateType: 'TransitExemption', aggregateId: exemption.id, payload: { busId: exemption.busId, exemptionType: exemption.exemptionType, authority: exemption.authority } });
    return exemption;
  }

  async decideExemption(uid: string, id: string, approved: boolean, actor: string) {
    const exemption = await this.repo(TransitExemption).findOne({ where: { ownerId: uid, id } });
    if (!exemption) throw new NotFoundException('Exemption not found');
    exemption.status = approved ? 'APPROVED' : 'REJECTED'; exemption.approvedBy = actor;
    await this.repo(TransitExemption).save(exemption); await this.refreshComplianceForOwner(uid); return exemption;
  }

  listExemptions(uid: string) { return this.repo(TransitExemption).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } }); }

  async createOffRoad(uid: string, input: Partial<TransitOffRoadPeriod>) {
    if (!input.busId || !input.reason || !input.startsAt || !input.endsAt) throw new BadRequestException('Bus, reason and dates are required');
    if (!await this.repo(TransitBus).findOne({ where: { ownerId: uid, id: input.busId } })) throw new NotFoundException('Bus not found');
    if (asDate(input.endsAt) <= asDate(input.startsAt)) throw new BadRequestException('Off-road end must be after start');
    return this.repo(TransitOffRoadPeriod).save(this.repo(TransitOffRoadPeriod).create({
      ownerId: uid, busId: input.busId, reason: input.reason, startsAt: asDate(input.startsAt), endsAt: asDate(input.endsAt),
      evidenceUrl: input.evidenceUrl ?? '', approvedBy: '', status: 'PENDING', feeTreatment: input.feeTreatment ?? 'NORMAL',
    }));
  }

  listOffRoad(uid: string) { return this.repo(TransitOffRoadPeriod).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } }); }

  async decideOffRoad(uid: string, id: string, approved: boolean, actor: string) {
    const period = await this.repo(TransitOffRoadPeriod).findOne({ where: { ownerId: uid, id } });
    if (!period) throw new NotFoundException('Off-road request not found');
    period.status = approved ? 'APPROVED' : 'REJECTED'; period.approvedBy = actor; await this.repo(TransitOffRoadPeriod).save(period);
    await this.refreshComplianceForOwner(uid); return period;
  }

  async createDispute(uid: string, input: Partial<TransitPaymentDispute>) {
    if (!input.busId || !input.transactionId || !input.amount || !input.paymentProvider || !input.paymentDate || !input.explanation) throw new BadRequestException('Complete all required dispute fields');
    const dispute = await this.repo(TransitPaymentDispute).save(this.repo(TransitPaymentDispute).create({
      ownerId: uid, busId: input.busId, transactionId: input.transactionId, amount: money(input.amount),
      paymentProvider: input.paymentProvider, paymentDate: asDate(input.paymentDate), receiptUrl: input.receiptUrl ?? '',
      explanation: input.explanation, status: 'SUBMITTED', resolutionNote: '',
    }));
    await this.events.emit({ ownerId: uid, eventName: 'transit.payment_dispute_created', aggregateType: 'TransitPaymentDispute', aggregateId: dispute.id, payload: { busId: dispute.busId, transactionId: dispute.transactionId, amount: dispute.amount, paymentProvider: dispute.paymentProvider } });
    return dispute;
  }

  listDisputes(uid: string) { return this.repo(TransitPaymentDispute).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } }); }

  async updateDispute(uid: string, id: string, status: TransitPaymentDispute['status'], resolutionNote = '') {
    const dispute = await this.repo(TransitPaymentDispute).findOne({ where: { ownerId: uid, id } });
    if (!dispute) throw new NotFoundException('Payment dispute not found');
    dispute.status = status; dispute.resolutionNote = resolutionNote.trim(); return this.repo(TransitPaymentDispute).save(dispute);
  }

  async ingestCamera(cameraId: string, apiKey: string, input: { plateNumber: string; confidence: number; direction?: string; imageUrl?: string; detectedAt?: string }) {
    const camera = await this.repo(TransitCamera).findOne({ where: { id: cameraId, active: true } });
    if (!camera || !camera.apiKeyHash || sha256(apiKey || '') !== camera.apiKeyHash) throw new BadRequestException('Invalid camera credentials');
    camera.lastHeartbeatAt = new Date(); await this.repo(TransitCamera).save(camera);
    return this.recordDetection(camera.ownerId, { cameraId: camera.id, ...input });
  }

  async cameraHeartbeat(cameraId: string, apiKey: string) {
    const camera = await this.repo(TransitCamera).findOne({ where: { id: cameraId, active: true } });
    if (!camera || !camera.apiKeyHash || sha256(apiKey || '') !== camera.apiKeyHash) throw new BadRequestException('Invalid camera credentials');
    camera.lastHeartbeatAt = new Date(); await this.repo(TransitCamera).save(camera);
    return { ok: true, cameraId, at: camera.lastHeartbeatAt };
  }

  async followTrip(tripId: string, input: { phone: string; name?: string; pickupCheckpointId?: string; notifyBeforeMinutes?: number; channels?: string[] }) {
    const trip = await this.repo(TransitTrip).findOne({ where: { id: tripId } });
    if (!trip || ['ARRIVED', 'CANCELLED'].includes(trip.status)) throw new NotFoundException('Active trip not found');
    const phone = input.phone.replace(/\s/g, ''); if (!phone) throw new BadRequestException('Phone is required');
    let row = await this.repo(TransitTripFollower).findOne({ where: { ownerId: trip.ownerId, tripId, phone } });
    row ??= this.repo(TransitTripFollower).create({ ownerId: trip.ownerId, tripId, phone, name: '', pickupCheckpointId: null, notifyBeforeMinutes: 30, channels: ['SMS', 'PUSH'], active: true });
    row.name = input.name?.trim() ?? row.name; row.pickupCheckpointId = input.pickupCheckpointId ?? row.pickupCheckpointId;
    row.notifyBeforeMinutes = Math.max(1, Number(input.notifyBeforeMinutes) || row.notifyBeforeMinutes); row.channels = input.channels?.length ? input.channels : row.channels; row.active = true;
    return this.repo(TransitTripFollower).save(row);
  }

  private async notifyTripFollowers(ownerId: string, tripId: string, detectionId: string) {
    const [trip, detection, followers] = await Promise.all([
      this.repo(TransitTrip).findOne({ where: { ownerId, id: tripId } }),
      this.repo(TransitPlateDetection).findOne({ where: { ownerId, id: detectionId } }),
      this.repo(TransitTripFollower).find({ where: { ownerId, tripId, active: true } }),
    ]);
    if (!trip || !detection) return;
    const checkpoint = detection.checkpointId ? await this.repo(TransitCheckpoint).findOne({ where: { ownerId, id: detection.checkpointId } }) : null;
    await this.repo(TransitTripLocationEvent).save(this.repo(TransitTripLocationEvent).create({ ownerId, tripId, busId: trip.busId, checkpointId: checkpoint?.id ?? null, locationName: checkpoint?.name || trip.currentCheckpoint, latitude: checkpoint?.latitude ?? '', longitude: checkpoint?.longitude ?? '', source: 'CAMERA', sourceEventId: detection.id, occurredAt: detection.detectedAt, eta: trip.eta ?? null })).catch(() => undefined);
    const eventKind: TransitArrivalAlert['kind'] = trip.status === 'ARRIVED' ? 'ARRIVED' : trip.status === 'DEPARTED' ? 'DEPARTED' : 'CHECKPOINT';
    await this.events.emit({ ownerId, eventName: eventKind === 'DEPARTED' ? 'transit.trip_started' : 'transit.checkpoint_passed', aggregateType: 'TransitTrip', aggregateId: trip.id, payload: { checkpoint: trip.currentCheckpoint, eta: trip.eta?.toISOString() ?? null } });
    if (trip.eta) await this.events.emit({ ownerId, eventName: 'transit.eta_updated', aggregateType: 'TransitTrip', aggregateId: trip.id, payload: { eta: trip.eta.toISOString(), checkpoint: trip.currentCheckpoint } });
    for (const follower of followers) {
      const minutes = trip.eta ? Math.max(0, Math.round((trip.eta.getTime() - Date.now()) / 60_000)) : null;
      const kind: TransitArrivalAlert['kind'] = tripFollowerAlertKind({ tripStatus: trip.status, eta: trip.eta, notifyBeforeMinutes: follower.notifyBeforeMinutes, pickupCheckpointId: follower.pickupCheckpointId, currentCheckpointId: checkpoint?.id });
      const eventKey = `${detection.id}:${kind}`;
      if (await this.repo(TransitArrivalAlert).findOne({ where: { ownerId, followerId: follower.id, eventKey } })) continue;
      const message = kind === 'DEPARTED' ? `Bus ${trip.tripCode} departed ${trip.origin}.`
        : kind === 'ARRIVED' ? `Bus ${trip.tripCode} arrived at ${trip.destination}.`
        : kind === 'PICKUP_ETA' ? `Bus ${trip.tripCode} is approximately ${minutes ?? 0} minutes from pickup.`
        : `Bus ${trip.tripCode} passed ${trip.currentCheckpoint || 'a checkpoint'}${minutes !== null ? `; ETA ${minutes} minutes` : ''}.`;
      const alert = await this.repo(TransitArrivalAlert).save(this.repo(TransitArrivalAlert).create({ ownerId, tripId, followerId: follower.id, eventKey, kind, message, status: 'PENDING' }));
      const channels = follower.channels.filter((c): c is 'IN_APP' | 'PUSH' | 'SMS' | 'WHATSAPP' | 'EMAIL' | 'VOICE' => ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP', 'EMAIL', 'VOICE'].includes(c));
      await this.notifications.send({ ownerId, recipientKey: follower.id, phone: follower.phone, title: 'Kobe Transit update', body: message, actionUrl: `/transit-board/${ownerId}`, channels: channels.length ? channels : ['IN_APP', 'SMS'] });
      alert.status = 'SENT'; alert.sentAt = new Date(); await this.repo(TransitArrivalAlert).save(alert);
      await this.events.emit({ ownerId, eventName: 'transit.arrival_alert_triggered', aggregateType: 'TransitArrivalAlert', aggregateId: alert.id, payload: { tripId, followerId: follower.id, kind } });
    }
  }

  async recordGps(ownerId: string, input: { tripId: string; latitude: string; longitude: string; locationName?: string; occurredAt?: string; eta?: string }) {
    const trip = await this.repo(TransitTrip).findOne({ where: { ownerId, id: input.tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    if (input.eta) trip.eta = new Date(input.eta); trip.currentCheckpoint = input.locationName?.trim() || trip.currentCheckpoint;
    if (trip.status === 'SCHEDULED' || trip.status === 'BOARDING') { trip.status = 'DEPARTED'; trip.actualDeparture ??= occurredAt; }
    else if (trip.status !== 'ARRIVED') trip.status = 'IN_TRANSIT';
    await this.repo(TransitTrip).save(trip);
    const bus = await this.repo(TransitBus).findOne({ where: { ownerId, id: trip.busId } });
    if (bus) { bus.currentLocation = trip.currentCheckpoint || `${input.latitude},${input.longitude}`; bus.lastSeenAt = occurredAt; await this.repo(TransitBus).save(bus); }
    return this.repo(TransitTripLocationEvent).save(this.repo(TransitTripLocationEvent).create({ ownerId, tripId: trip.id, busId: trip.busId, checkpointId: null, locationName: trip.currentCheckpoint, latitude: input.latitude, longitude: input.longitude, source: 'GPS', sourceEventId: code('GPS'), occurredAt, eta: trip.eta ?? null }));
  }

  async publicTransportSearch(query: { origin?: string; destination?: string; date?: string }) {
    const qb = this.repo(TransitTrip).createQueryBuilder('t').where("t.status IN ('SCHEDULED','BOARDING')");
    if (query.origin) qb.andWhere('LOWER(t.origin) LIKE :origin', { origin: `%${query.origin.toLowerCase()}%` });
    if (query.destination) qb.andWhere('LOWER(t.destination) LIKE :destination', { destination: `%${query.destination.toLowerCase()}%` });
    if (query.date) qb.andWhere('DATE(t.scheduledDeparture) = :date', { date: query.date });
    const trips = await qb.orderBy('t.scheduledDeparture', 'ASC').take(100).getMany();
    return Promise.all(trips.map(async (trip) => {
      const bus = await this.repo(TransitBus).findOne({ where: { id: trip.busId } });
      const operator = bus && await this.repo(TransitOperator).findOne({ where: { id: bus.operatorId } });
      const sold = await this.repo(TransitTicket).count({ where: { ownerId: trip.ownerId, tripId: trip.id, status: In(['RESERVED', 'PAID', 'BOARDED']) } });
      return { trip, operator: operator?.name ?? '', bus: bus?.name ?? '', capacity: bus?.capacity ?? 0, availableSeats: Math.max(0, (bus?.capacity ?? 0) - sold), liveStatus: trip.status, canBuy: sold < (bus?.capacity ?? 0) };
    }));
  }

  async reserveTicket(tripId: string, input: { passengerName: string; passengerPhone: string; seatNumber: string; fare: number; currency?: string }) {
    const trip = await this.repo(TransitTrip).findOne({ where: { id: tripId } });
    if (!trip || !['SCHEDULED', 'BOARDING'].includes(trip.status)) throw new NotFoundException('Bookable trip not found');
    if (await this.repo(TransitTicket).findOne({ where: { ownerId: trip.ownerId, tripId, seatNumber: input.seatNumber, status: In(['RESERVED', 'PAID', 'BOARDED']) } })) throw new BadRequestException('Seat is unavailable');
    const ticket = await this.repo(TransitTicket).save(this.repo(TransitTicket).create({ ownerId: trip.ownerId, tripId, ticketNumber: code('TKT'), passengerName: input.passengerName, passengerPhone: input.passengerPhone, seatNumber: input.seatNumber, fare: money(input.fare), currency: input.currency ?? 'TZS', status: 'RESERVED', paymentReference: '' }));
    await this.repo(TransitPassengerManifest).save(this.repo(TransitPassengerManifest).create({ ownerId: trip.ownerId, tripId, ticketId: ticket.id, passengerName: ticket.passengerName, passengerPhone: ticket.passengerPhone, seatNumber: ticket.seatNumber, boarded: false }));
    return ticket;
  }

  async recordVehicleCheckpoint(ownerId: string, input: { vehicleType: TransitVehicleCheckpointEvent['vehicleType']; vehicleId: string; checkpointId?: string; locationName?: string; source?: TransitVehicleCheckpointEvent['source']; occurredAt?: string; metadata?: Record<string, unknown> }) {
    return this.repo(TransitVehicleCheckpointEvent).save(this.repo(TransitVehicleCheckpointEvent).create({ ownerId, vehicleType: input.vehicleType, vehicleId: input.vehicleId, checkpointId: input.checkpointId ?? null, locationName: input.locationName ?? '', source: input.source ?? 'MANUAL', occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(), metadata: input.metadata ?? {} }));
  }

  async grantAuthority(ownerId: string, actor: string, input: { authorityUserId: string; role: TransitAuthorityGrant['role']; scope?: Record<string, unknown> }) {
    let grant = await this.repo(TransitAuthorityGrant).findOne({ where: { ownerId, authorityUserId: input.authorityUserId, role: input.role } });
    grant ??= this.repo(TransitAuthorityGrant).create({ ownerId, authorityUserId: input.authorityUserId, role: input.role, scope: {}, active: true, grantedBy: actor });
    grant.scope = input.scope ?? grant.scope; grant.active = true; grant.grantedBy = actor; return this.repo(TransitAuthorityGrant).save(grant);
  }

  async governmentScope(requestingUserId: string, requestedOwnerId?: string, allowedRoles: TransitAuthorityGrant['role'][] = ['government_viewer', 'settlement_officer', 'compliance_officer', 'traffic_enforcement']) {
    const ownerId = requestedOwnerId || requestingUserId;
    if (ownerId === requestingUserId) return ownerId;
    const grant = await this.repo(TransitAuthorityGrant).findOne({ where: { ownerId, authorityUserId: requestingUserId, active: true, role: In(allowedRoles) } });
    if (!grant) throw new ForbiddenException('No permission for this transit authority scope');
    return ownerId;
  }

  async analytics(ownerId: string) {
    const [trips, buses, detections, periods, exemptions, disputes, cameras, locations] = await Promise.all([
      this.repo(TransitTrip).find({ where: { ownerId }, take: 10_000 }), this.repo(TransitBus).find({ where: { ownerId }, take: 10_000 }),
      this.repo(TransitPlateDetection).find({ where: { ownerId }, take: 20_000 }), this.repo(TransitFeePeriod).find({ where: { ownerId }, take: 20_000 }),
      this.repo(TransitExemption).count({ where: { ownerId } }), this.repo(TransitPaymentDispute).count({ where: { ownerId } }),
      this.repo(TransitCamera).find({ where: { ownerId } }), this.repo(TransitTripLocationEvent).find({ where: { ownerId }, take: 20_000 }),
    ]);
    const completed = trips.filter((t) => t.actualArrival && t.actualDeparture);
    const onTime = trips.filter((t) => t.actualDeparture && t.actualDeparture <= t.scheduledDeparture).length;
    const paid = periods.filter((p) => p.status === 'PAID').length;
    const overdue = periods.filter((p) => p.status === 'OVERDUE').length;
    return {
      operational: { trips: trips.length, completedTrips: completed.length, onTimePercent: trips.length ? Math.round(onTime / trips.length * 10000) / 100 : 0, averageDelayMinutes: trips.length ? Math.round(trips.reduce((s, t) => s + t.delayMinutes, 0) / trips.length) : 0, locationEvents: locations.length },
      compliance: { registeredBuses: buses.length, paidPeriods: paid, overduePeriods: overdue, collectionRate: paid + overdue ? Math.round(paid / (paid + overdue) * 10000) / 100 : 0, exemptions, disputes, repeatLatePayers: 0 },
      cameras: { configured: cameras.length, online: cameras.filter((c) => c.lastHeartbeatAt && Date.now() - c.lastHeartbeatAt.getTime() < 10 * 60_000).length, detections: detections.length, failedDetections: detections.filter((d) => !d.busId).length, manualReviews: detections.filter((d) => d.reviewStatus === 'MANUAL_REVIEW').length, duplicateReads: 0, averageConfidence: detections.length ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length : 0 },
    };
  }

  private async dispatchEnforcementWebhook(policy: TransitFeePolicy, alert: TransitEnforcementAlert, detection: TransitPlateDetection) {
    const url = String(policy.enforcementRules?.webhookUrl ?? ''); if (!url) return;
    const secret = String(policy.enforcementRules?.webhookSecret ?? '');
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) }, body: JSON.stringify({ type: 'transit.enforcement_alert_created', alert, detection }) }).catch(() => undefined);
  }
}
