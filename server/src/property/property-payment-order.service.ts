import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import { Property, PropertyUnit, RentCharge, RentPayment, Tenant } from './property.entity';
import {
  CollectionChannel,
  PropertyCollectionPartner,
  PropertyPaymentOrder,
  PropertyPaymentRedemption,
} from './property-payment-order.entity';
import {
  CancelPropertyPaymentOrderDto,
  CreateCollectionPartnerDto,
  CreatePropertyPaymentOrderDto,
  PartnerLoginDto,
  RedeemPropertyPaymentOrderDto,
} from './dto/property-payment-order.dto';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface PartnerSession {
  partnerId: string;
  ownerId: string;
  type: 'BANK' | 'AGENT';
  exp: number;
}

function code(length = 10): string {
  return Array.from({ length }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join('');
}

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(pin, salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function monthStart(period?: string): Date {
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

@Injectable()
export class PropertyPaymentOrderService {
  private readonly sessionSecret: string;

  constructor(
    @InjectRepository(PropertyPaymentOrder)
    private readonly orders: Repository<PropertyPaymentOrder>,
    @InjectRepository(PropertyCollectionPartner)
    private readonly partners: Repository<PropertyCollectionPartner>,
    @InjectRepository(PropertyPaymentRedemption)
    private readonly redemptions: Repository<PropertyPaymentRedemption>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(PropertyUnit)
    private readonly units: Repository<PropertyUnit>,
    @InjectRepository(Property)
    private readonly properties: Repository<Property>,
    @InjectRepository(RentCharge)
    private readonly charges: Repository<RentCharge>,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.sessionSecret = config.get<string>('PROPERTY_COLLECTION_SESSION_SECRET')
      || config.get<string>('JWT_SECRET')
      || 'kobeos-local-property-collection-secret';
  }

  private signSession(payload: PartnerSession): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.sessionSecret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  private parseSession(token: string): PartnerSession {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) throw new UnauthorizedException('Collection partner session is required');
    const expected = createHmac('sha256', this.sessionSecret).update(encoded).digest('base64url');
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid collection partner session');
    }
    let payload: PartnerSession;
    try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as PartnerSession; }
    catch { throw new UnauthorizedException('Invalid collection partner session'); }
    if (!payload.exp || payload.exp < Date.now()) throw new UnauthorizedException('Collection partner session has expired');
    return payload;
  }

  private async partnerFromSession(sessionToken: string) {
    const session = this.parseSession(sessionToken);
    const partner = await this.partners.findOne({
      where: { id: session.partnerId, ownerId: session.ownerId, status: 'ACTIVE' },
    });
    if (!partner) throw new UnauthorizedException('Collection partner is inactive');
    return { session, partner };
  }

  async createPartner(ownerId: string, dto: CreateCollectionPartnerDto) {
    const partnerCode = dto.partnerCode.trim().toUpperCase();
    if (dto.pin.length < 4) throw new BadRequestException('Partner PIN must be at least 4 characters');
    const duplicate = await this.partners.findOne({ where: { ownerId, partnerCode } });
    if (duplicate) throw new ConflictException(`Partner code ${partnerCode} already exists`);
    const partner = await this.partners.save(this.partners.create({
      ownerId,
      name: dto.name.trim(),
      type: dto.type,
      partnerCode,
      pinHash: hashPin(dto.pin),
      commissionPct: dto.commissionPct ?? 0,
      status: 'ACTIVE',
      phone: dto.phone?.trim() ?? '',
      branch: dto.branch?.trim() ?? '',
    }));
    const { pinHash: _secret, ...safe } = partner;
    return safe;
  }

  async listPartners(ownerId: string) {
    const rows = await this.partners.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
    return rows.map(({ pinHash: _secret, ...partner }) => partner);
  }

  async login(dto: PartnerLoginDto) {
    const partnerCode = dto.partnerCode.trim().toUpperCase();
    const partner = await this.partners.findOne({ where: { partnerCode, status: 'ACTIVE' } });
    if (!partner || !verifyPin(dto.pin, partner.pinHash)) {
      throw new UnauthorizedException('Invalid partner code or PIN');
    }
    partner.lastLoginAt = new Date();
    await this.partners.save(partner);
    const expiresAt = Date.now() + SESSION_TTL_MS;
    return {
      sessionToken: this.signSession({
        partnerId: partner.id,
        ownerId: partner.ownerId,
        type: partner.type,
        exp: expiresAt,
      }),
      expiresAt: new Date(expiresAt).toISOString(),
      partner: {
        id: partner.id,
        name: partner.name,
        type: partner.type,
        partnerCode: partner.partnerCode,
        branch: partner.branch,
        commissionPct: partner.commissionPct,
      },
    };
  }

  async createOrder(ownerId: string, dto: CreatePropertyPaymentOrderDto) {
    const [tenant, unit, assignedPartner] = await Promise.all([
      this.tenants.findOne({ where: { ownerId, id: dto.tenantId } }),
      this.units.findOne({ where: { ownerId, id: dto.unitId } }),
      dto.assignedPartnerId
        ? this.partners.findOne({ where: { ownerId, id: dto.assignedPartnerId, status: 'ACTIVE' } })
        : Promise.resolve(null),
    ]);
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (!unit) throw new NotFoundException('Unit not found');
    if (tenant.unitId && tenant.unitId !== unit.id) throw new BadRequestException('Tenant is not assigned to this unit');
    if (dto.assignedPartnerId && !assignedPartner) throw new NotFoundException('Collection partner not found');

    let charge: RentCharge | null = null;
    let maximum = Number(dto.expectedAmount);
    if (dto.chargeId) {
      charge = await this.charges.findOne({ where: { ownerId, id: dto.chargeId } });
      if (!charge) throw new NotFoundException('Rent charge not found');
      if (charge.tenantId !== tenant.id || charge.unitId !== unit.id) {
        throw new BadRequestException('Charge does not belong to this tenant and unit');
      }
      if (charge.status === 'paid' || charge.status === 'waived') {
        throw new BadRequestException('This rent charge is not unpaid');
      }
      maximum = Math.max(0, Number(charge.amount) - Number(charge.amountPaid));
      if (Number(dto.expectedAmount) > maximum) {
        throw new BadRequestException(`Expected amount exceeds the unpaid charge balance of ${maximum}`);
      }
      const duplicate = await this.orders.findOne({
        where: { ownerId, chargeId: charge.id, status: 'ACTIVE' },
      });
      if (duplicate) throw new ConflictException(`Active payment order ${duplicate.code} already exists for this charge`);
    }

    const expiresAt = new Date(dto.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException('Expiry must be in the future');
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await this.orders.save(this.orders.create({
          ownerId,
          code: code(10),
          publicToken: randomBytes(24).toString('hex'),
          tenantId: tenant.id,
          unitId: unit.id,
          chargeId: charge?.id ?? null,
          invoiceReference: dto.invoiceReference?.trim() || charge?.period || `RENT-${Date.now()}`,
          expectedAmount: Number(dto.expectedAmount),
          paidAmount: 0,
          currency: dto.currency || 'TZS',
          allowedVariance: Math.min(Number(dto.allowedVariance || 0), maximum),
          partialAllowed: Boolean(dto.partialAllowed),
          allowedChannels: [...new Set(dto.allowedChannels)],
          assignedPartnerId: assignedPartner?.id ?? null,
          status: 'ACTIVE',
          expiresAt,
        }));
      } catch (error) {
        if (attempt === 7) throw error;
      }
    }
    throw new BadRequestException('Could not generate a unique payment order');
  }

  async listOrders(ownerId: string, status?: PropertyPaymentOrder['status']) {
    const rows = await this.orders.find({
      where: status ? { ownerId, status } : { ownerId },
      order: { createdAt: 'DESC' },
      take: 1000,
    });
    const tenantIds = [...new Set(rows.map((row) => row.tenantId))];
    const unitIds = [...new Set(rows.map((row) => row.unitId))];
    const partnerIds = [...new Set(rows.map((row) => row.assignedPartnerId).filter(Boolean) as string[])];
    const [tenants, units, partners] = await Promise.all([
      tenantIds.length ? this.tenants.createQueryBuilder('tenant').where('tenant.id IN (:...ids)', { ids: tenantIds }).getMany() : [],
      unitIds.length ? this.units.createQueryBuilder('unit').where('unit.id IN (:...ids)', { ids: unitIds }).getMany() : [],
      partnerIds.length ? this.partners.createQueryBuilder('partner').where('partner.id IN (:...ids)', { ids: partnerIds }).getMany() : [],
    ]);
    const tenantMap = new Map(tenants.map((row) => [row.id, row]));
    const unitMap = new Map(units.map((row) => [row.id, row]));
    const partnerMap = new Map(partners.map((row) => [row.id, row]));
    return rows.map((row) => ({
      ...row,
      remainingAmount: Math.max(0, Number(row.expectedAmount) - Number(row.paidAmount)),
      tenantName: tenantMap.get(row.tenantId)?.name || 'Tenant',
      unitNumber: unitMap.get(row.unitId)?.unitNumber || '',
      partnerName: row.assignedPartnerId ? partnerMap.get(row.assignedPartnerId)?.name || '' : 'Any authorised partner',
    }));
  }

  async cancelOrder(ownerId: string, id: string, dto: CancelPropertyPaymentOrderDto) {
    const order = await this.orders.findOne({ where: { ownerId, id } });
    if (!order) throw new NotFoundException('Payment order not found');
    if (order.status === 'PAID') throw new BadRequestException('A paid order cannot be cancelled');
    if (order.status === 'CANCELLED') return order;
    order.status = 'CANCELLED';
    order.cancelledAt = new Date();
    order.cancellationReason = dto.reason.trim();
    return this.orders.save(order);
  }

  async lookupForPartner(sessionToken: string, codeOrToken: string) {
    const { partner } = await this.partnerFromSession(sessionToken);
    const key = codeOrToken.trim().toUpperCase();
    const order = await this.orders.findOne({
      where: key.length > 16
        ? { publicToken: codeOrToken.trim() }
        : { code: key },
    });
    if (!order || order.ownerId !== partner.ownerId) throw new NotFoundException('Payment order not found');
    if (order.assignedPartnerId && order.assignedPartnerId !== partner.id) {
      throw new UnauthorizedException('This payment order is assigned to another collection partner');
    }
    const now = Date.now();
    const derivedStatus = (order.status === 'ACTIVE' || order.status === 'PARTIALLY_PAID') && order.expiresAt.getTime() < now
      ? 'EXPIRED'
      : order.status;
    const [tenant, unit] = await Promise.all([
      this.tenants.findOne({ where: { ownerId: order.ownerId, id: order.tenantId } }),
      this.units.findOne({ where: { ownerId: order.ownerId, id: order.unitId } }),
    ]);
    const property = unit?.propertyId
      ? await this.properties.findOne({ where: { ownerId: order.ownerId, id: unit.propertyId } })
      : null;
    return {
      code: order.code,
      publicToken: order.publicToken,
      status: derivedStatus,
      payer: {
        name: tenant?.name || 'Tenant',
        phone: tenant?.phone || '',
      },
      property: {
        name: property?.name || '',
        unit: unit?.unitNumber || '',
        address: property?.address || '',
      },
      invoiceReference: order.invoiceReference,
      expectedAmount: Number(order.expectedAmount),
      paidAmount: Number(order.paidAmount),
      remainingAmount: Math.max(0, Number(order.expectedAmount) - Number(order.paidAmount)),
      currency: order.currency,
      partialAllowed: order.partialAllowed,
      allowedVariance: Number(order.allowedVariance),
      allowedChannels: order.allowedChannels,
      expiresAt: order.expiresAt,
      partner: { name: partner.name, type: partner.type, branch: partner.branch },
    };
  }

  async redeem(sessionToken: string, codeOrToken: string, dto: RedeemPropertyPaymentOrderDto) {
    const { partner } = await this.partnerFromSession(sessionToken);
    const amount = Number(dto.amountReceived);
    if (amount <= 0) throw new BadRequestException('Amount received must be positive');

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(PropertyPaymentOrder);
      const redemptionRepo = manager.getRepository(PropertyPaymentRedemption);
      const order = await orderRepo.createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where(codeOrToken.length > 16 ? 'order.publicToken = :key' : 'order.code = :key', {
          key: codeOrToken.length > 16 ? codeOrToken.trim() : codeOrToken.trim().toUpperCase(),
        })
        .getOne();
      if (!order || order.ownerId !== partner.ownerId) throw new NotFoundException('Payment order not found');
      if (order.assignedPartnerId && order.assignedPartnerId !== partner.id) {
        throw new UnauthorizedException('This payment order is assigned to another collection partner');
      }

      const existing = await redemptionRepo.findOne({
        where: { ownerId: order.ownerId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        if (existing.orderId !== order.id) throw new ConflictException('Idempotency key already used for another payment');
        return this.receiptFor(manager, existing, order, partner);
      }

      if ((order.status === 'ACTIVE' || order.status === 'PARTIALLY_PAID') && order.expiresAt.getTime() < Date.now()) {
        order.status = 'EXPIRED';
        await orderRepo.save(order);
        throw new BadRequestException('Payment order has expired');
      }
      if (!['ACTIVE', 'PARTIALLY_PAID'].includes(order.status)) {
        throw new BadRequestException(`Payment order is ${order.status.toLowerCase()}`);
      }
      if (!order.allowedChannels.includes(dto.channel)) {
        throw new BadRequestException(`${dto.channel} is not allowed for this payment order`);
      }

      const expected = Number(order.expectedAmount);
      const alreadyPaid = Number(order.paidAmount);
      const remaining = Math.max(0, expected - alreadyPaid);
      if (amount > remaining) throw new BadRequestException(`Overpayment is not allowed. Remaining amount is ${remaining}`);
      if (!order.partialAllowed && amount < Math.max(0, remaining - Number(order.allowedVariance))) {
        throw new BadRequestException(`Partial payment is not allowed. Collect ${remaining} ${order.currency}`);
      }

      const nextPaid = alreadyPaid + amount;
      const remainingAfter = Math.max(0, expected - nextPaid);
      const fullyPaid = remainingAfter <= Number(order.allowedVariance);
      order.paidAmount = nextPaid;
      order.status = fullyPaid ? 'PAID' : 'PARTIALLY_PAID';
      if (fullyPaid) order.paidAt = new Date();
      await orderRepo.save(order);

      const commissionAmount = amount * Number(partner.commissionPct || 0) / 100;
      const redemption = await redemptionRepo.save(redemptionRepo.create({
        ownerId: order.ownerId,
        orderId: order.id,
        partnerId: partner.id,
        idempotencyKey: dto.idempotencyKey,
        amount,
        currency: order.currency,
        channel: dto.channel,
        reference: dto.reference?.trim() ?? '',
        commissionAmount,
        status: 'CONFIRMED',
        receivedAt: new Date(),
      }));

      let charge: RentCharge | null = null;
      if (order.chargeId) {
        charge = await manager.getRepository(RentCharge).createQueryBuilder('charge')
          .setLock('pessimistic_write')
          .where('charge.ownerId = :ownerId AND charge.id = :id', { ownerId: order.ownerId, id: order.chargeId })
          .getOne();
        if (!charge) throw new NotFoundException('Linked rent charge not found');
        charge.amountPaid = Math.min(Number(charge.amount), Number(charge.amountPaid) + amount);
        charge.status = Number(charge.amountPaid) >= Number(charge.amount) ? 'paid' : 'partial';
        await manager.getRepository(RentCharge).save(charge);
      }

      await manager.getRepository(RentPayment).save(manager.getRepository(RentPayment).create({
        ownerId: order.ownerId,
        chargeId: order.chargeId ?? null,
        tenantId: order.tenantId,
        unitId: order.unitId,
        amount,
        currency: order.currency,
        forMonth: monthStart(charge?.period),
        paidAt: new Date(),
        method: `TOKEN_${dto.channel}`,
        reference: `${order.code}:${redemption.id}`,
        notes: `Collected by ${partner.type.toLowerCase()} ${partner.name}`,
      }));

      return this.receiptFor(manager, redemption, order, partner);
    });
  }

  private async receiptFor(
    manager: Parameters<DataSource['transaction']>[0] extends (manager: infer M) => unknown ? M : never,
    redemption: PropertyPaymentRedemption,
    order: PropertyPaymentOrder,
    partner: PropertyCollectionPartner,
  ) {
    const tenant = await manager.getRepository(Tenant).findOne({ where: { id: order.tenantId } });
    const unit = await manager.getRepository(PropertyUnit).findOne({ where: { id: order.unitId } });
    return {
      receiptId: redemption.id,
      orderCode: order.code,
      payerName: tenant?.name || 'Tenant',
      unitNumber: unit?.unitNumber || '',
      amount: Number(redemption.amount),
      currency: redemption.currency,
      channel: redemption.channel,
      reference: redemption.reference,
      partnerName: partner.name,
      partnerType: partner.type,
      commissionAmount: Number(redemption.commissionAmount),
      receivedAt: redemption.receivedAt,
      orderStatus: order.status,
      totalPaid: Number(order.paidAmount),
      remainingAmount: Math.max(0, Number(order.expectedAmount) - Number(order.paidAmount)),
    };
  }

  async reconciliation(ownerId: string, partnerId?: string) {
    const qb = this.redemptions.createQueryBuilder('redemption')
      .where('redemption.ownerId = :ownerId', { ownerId })
      .orderBy('redemption.receivedAt', 'DESC')
      .take(5000);
    if (partnerId) qb.andWhere('redemption.partnerId = :partnerId', { partnerId });
    const rows = await qb.getMany();
    const partnerIds = [...new Set(rows.map((row) => row.partnerId))];
    const partners = partnerIds.length
      ? await this.partners.createQueryBuilder('partner').where('partner.id IN (:...ids)', { ids: partnerIds }).getMany()
      : [];
    const partnerMap = new Map(partners.map((row) => [row.id, row]));
    return {
      totals: {
        confirmedAmount: rows.filter((row) => row.status === 'CONFIRMED').reduce((sum, row) => sum + Number(row.amount), 0),
        commissionAmount: rows.filter((row) => row.status === 'CONFIRMED').reduce((sum, row) => sum + Number(row.commissionAmount), 0),
        reversedAmount: rows.filter((row) => row.status === 'REVERSED').reduce((sum, row) => sum + Number(row.amount), 0),
        count: rows.length,
      },
      rows: rows.map((row) => ({ ...row, partnerName: partnerMap.get(row.partnerId)?.name || '' })),
    };
  }

  async reverse(ownerId: string, redemptionId: string, reason: string) {
    if (!reason.trim()) throw new BadRequestException('Reversal reason is required');
    return this.dataSource.transaction(async (manager) => {
      const redemptionRepo = manager.getRepository(PropertyPaymentRedemption);
      const redemption = await redemptionRepo.createQueryBuilder('redemption')
        .setLock('pessimistic_write')
        .where('redemption.ownerId = :ownerId AND redemption.id = :id', { ownerId, id: redemptionId })
        .getOne();
      if (!redemption) throw new NotFoundException('Collection receipt not found');
      if (redemption.status === 'REVERSED') return redemption;

      const orderRepo = manager.getRepository(PropertyPaymentOrder);
      const order = await orderRepo.createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.ownerId = :ownerId AND order.id = :id', { ownerId, id: redemption.orderId })
        .getOne();
      if (!order) throw new NotFoundException('Payment order not found');

      const amount = Number(redemption.amount);
      order.paidAmount = Math.max(0, Number(order.paidAmount) - amount);
      order.paidAt = null;
      order.status = Number(order.paidAmount) > 0 ? 'PARTIALLY_PAID' : 'ACTIVE';
      await orderRepo.save(order);

      if (order.chargeId) {
        const chargeRepo = manager.getRepository(RentCharge);
        const charge = await chargeRepo.createQueryBuilder('charge')
          .setLock('pessimistic_write')
          .where('charge.ownerId = :ownerId AND charge.id = :id', { ownerId, id: order.chargeId })
          .getOne();
        if (charge) {
          charge.amountPaid = Math.max(0, Number(charge.amountPaid) - amount);
          charge.status = Number(charge.amountPaid) > 0 ? 'partial' : 'open';
          await chargeRepo.save(charge);
        }
      }

      await manager.getRepository(RentPayment).save(manager.getRepository(RentPayment).create({
        ownerId,
        chargeId: order.chargeId ?? null,
        tenantId: order.tenantId,
        unitId: order.unitId,
        amount: -amount,
        currency: order.currency,
        forMonth: monthStart(),
        paidAt: new Date(),
        method: 'TOKEN_REVERSAL',
        reference: `${order.code}:${redemption.id}:REVERSAL`,
        notes: reason.trim(),
      }));

      redemption.status = 'REVERSED';
      redemption.reversedAt = new Date();
      redemption.reversalReason = reason.trim();
      return redemptionRepo.save(redemption);
    });
  }
}
