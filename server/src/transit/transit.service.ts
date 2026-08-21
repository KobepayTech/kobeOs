import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { JournalService } from '../erp/journal.service';
import { BeemService } from '../notifications/beem.service';
import { InboundPayment } from '../mobile-money/mobile-money.entity';
import { PaymentTransaction } from '../payments/payments.entity';
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
  TransitUnpaidDetection,
} from './transit.entity';
import {
  calculateCompliance,
  displayTransitPlate,
  nextFeeWindow,
  normalizeTransitPlate,
  splitTransitFee,
  shouldAutomaticallyProcessAnpr,
  TransitComplianceState,
} from './transit.rules';

const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;
const code = (prefix: string) => `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
const asDate = (value: string | Date) => value instanceof Date ? value : new Date(value);

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
    return this.repo(TransitCamera).save(this.repo(TransitCamera).create({
      ownerId: uid, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      checkpointId: input.checkpointId || null, location: input.location?.trim() ?? '',
      direction: input.direction ?? 'BOTH', confidenceThreshold: Number(input.confidenceThreshold ?? 0.85), active: true,
    }));
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
    return this.ds.transaction(async (tx) => {
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
      await this.audit(tx, uid, bus.id, plate.id, 'BUS_REGISTERED', `bus:${bus.id}:registered`, '', bus.complianceStatus, `${plate.plateNumber} registered`);
      return { bus, plate };
    });
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
    return this.repo(TransitTrip).save(this.repo(TransitTrip).create({
      ownerId: uid, busId: bus.id, routeId: input.routeId || bus.routeId || null, tripCode,
      origin: input.origin.trim(), destination: input.destination.trim(), scheduledDeparture,
      scheduledArrival: input.scheduledArrival ? asDate(input.scheduledArrival) : null,
      eta: input.scheduledArrival ? asDate(input.scheduledArrival) : null,
      status: input.status ?? 'SCHEDULED', gate: input.gate?.trim() ?? '', currentCheckpoint: '', delayMinutes: 0,
    }));
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
    return this.repo(TransitPlateDetection).save(detection);
  }

  async refreshComplianceForOwner(uid: string) {
    const policy = await this.ensurePolicy(uid);
    const notifications: Array<{ phone: string; message: string }> = [];
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
        }
        if (next === 'DUE_SOON' || next === 'OVERDUE') {
          const key = `reminder:${bus.id}:${dayKey}:${next}`;
          if (!await tx.getRepository(TransitComplianceAudit).findOne({ where: { ownerId: uid, eventKey: key } })) {
            const plate = plates.find((item) => item.id === bus.currentPlateId);
            const message = next === 'OVERDUE'
              ? `${plate?.plateNumber ?? bus.name} is overdue. Its Transit compliance status is now OVERDUE.`
              : `Transit fee for ${plate?.plateNumber ?? bus.name} is due soon.`;
            await this.audit(tx, uid, bus.id, bus.currentPlateId, 'PAYMENT_REMINDER', key, next, next, message);
            const operator = operators.find((item) => item.id === bus.operatorId);
            if (operator?.phone) notifications.push({ phone: operator.phone, message });
          }
        }
      }
      return count;
    });
    await Promise.allSettled(notifications.map((item) => this.beem.sendSms(item.phone, item.message)));
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

  async governmentOverview(uid: string, filters: { status?: string; operatorId?: string; plate?: string; method?: string; from?: string; to?: string }) {
    const dashboard = await this.dashboard(uid);
    let buses = dashboard.buses;
    if (filters.status) buses = buses.filter((row) => row.complianceStatus === filters.status);
    if (filters.operatorId) buses = buses.filter((row) => row.operatorId === filters.operatorId);
    if (filters.plate) { const q = normalizeTransitPlate(filters.plate); buses = buses.filter((row) => row.plate?.normalizedPlate.includes(q)); }
    let payments = dashboard.recentPayments;
    if (filters.method) payments = payments.filter((row) => row.method === filters.method);
    if (filters.from) payments = payments.filter((row) => new Date(row.createdAt) >= new Date(filters.from!));
    if (filters.to) payments = payments.filter((row) => new Date(row.createdAt) <= new Date(filters.to!));
    return { ...dashboard, buses, recentPayments: payments, appliedFilters: filters };
  }

  async plateDrilldown(uid: string, plateNumber: string) {
    const plate = await this.repo(TransitPlate).findOne({ where: { ownerId: uid, normalizedPlate: normalizeTransitPlate(plateNumber) } });
    if (!plate) throw new NotFoundException('Plate not found');
    const bus = await this.repo(TransitBus).findOne({ where: { ownerId: uid, id: plate.busId } });
    if (!bus) throw new NotFoundException('Bus not found');
    const [operator, periods, allocations, detections, alerts, audit, plateHistory] = await Promise.all([
      this.repo(TransitOperator).findOne({ where: { ownerId: uid, id: bus.operatorId } }),
      this.repo(TransitFeePeriod).find({ where: { ownerId: uid, busId: bus.id }, order: { periodStart: 'DESC' } }),
      this.repo(TransitFeeAllocation).find({ where: { ownerId: uid, busId: bus.id }, order: { createdAt: 'DESC' } }),
      this.repo(TransitPlateDetection).find({ where: { ownerId: uid, busId: bus.id }, order: { detectedAt: 'DESC' }, take: 250 }),
      this.repo(TransitEnforcementAlert).find({ where: { ownerId: uid, busId: bus.id }, order: { createdAt: 'DESC' } }),
      this.repo(TransitComplianceAudit).find({ where: { ownerId: uid, busId: bus.id }, order: { createdAt: 'DESC' } }),
      this.repo(TransitPlate).find({ where: { ownerId: uid, busId: bus.id }, order: { effectiveFrom: 'DESC' } }),
    ]);
    const paymentIds = [...new Set(allocations.map((row) => row.paymentId))];
    const payments = paymentIds.length ? await this.repo(TransitFeePayment).find({ where: { ownerId: uid, id: In(paymentIds) }, order: { createdAt: 'DESC' } }) : [];
    return { plate, plateHistory, bus, operator, compliance: bus.complianceStatus, periods, payments, allocations, detections, alerts, audit };
  }

  async createSettlement(uid: string, input: { periodStart: string; periodEnd: string }) {
    const periodStart = new Date(input.periodStart); const periodEnd = new Date(input.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd < periodStart) throw new BadRequestException('Enter a valid settlement period');
    return this.ds.transaction(async (tx) => {
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
  }

  listSettlements(uid: string) {
    return this.repo(TransitGovernmentSettlement).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  async settle(uid: string, id: string, input: { paymentReference: string; settledAmount?: number }) {
    if (!input.paymentReference?.trim()) throw new BadRequestException('Government payment reference is required');
    return this.ds.transaction(async (tx) => {
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
    return this.repo(TransitExemption).save(this.repo(TransitExemption).create({
      ownerId: uid, busId: input.busId, exemptionType: input.exemptionType, authority: input.authority,
      reason: input.reason, effectiveAt: asDate(input.effectiveAt), expiresAt: asDate(input.expiresAt),
      supportingDocumentUrl: input.supportingDocumentUrl ?? '', createdBy: actor, approvedBy: '', status: 'PENDING',
    }));
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
    return this.repo(TransitOffRoadPeriod).save(this.repo(TransitOffRoadPeriod).create({
      ownerId: uid, busId: input.busId, reason: input.reason, startsAt: asDate(input.startsAt), endsAt: asDate(input.endsAt),
      evidenceUrl: input.evidenceUrl ?? '', approvedBy: '', status: 'PENDING', feeTreatment: input.feeTreatment ?? 'NORMAL',
    }));
  }

  async createDispute(uid: string, input: Partial<TransitPaymentDispute>) {
    if (!input.busId || !input.transactionId || !input.amount || !input.paymentProvider || !input.paymentDate || !input.explanation) throw new BadRequestException('Complete all required dispute fields');
    return this.repo(TransitPaymentDispute).save(this.repo(TransitPaymentDispute).create({
      ownerId: uid, busId: input.busId, transactionId: input.transactionId, amount: money(input.amount),
      paymentProvider: input.paymentProvider, paymentDate: asDate(input.paymentDate), receiptUrl: input.receiptUrl ?? '',
      explanation: input.explanation, status: 'SUBMITTED', resolutionNote: '',
    }));
  }

  listDisputes(uid: string) { return this.repo(TransitPaymentDispute).find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } }); }
}
