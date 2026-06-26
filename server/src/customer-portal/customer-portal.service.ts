import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BeemService } from '../notifications/beem.service';
import { Parcel } from '../cargo/cargo.entity';
import { PosOrder, PosOrderItem } from '../pos/pos.entity';
import { CargoCustomer } from '../cargo/cargo.entity';
import { LoyaltyCustomer } from '../erp/erp.entity';
import { MzigoParcel } from '../mzigo/mzigo.entity';

/**
 * Customer-facing self-serve portal. Phone-based, OTP-only auth.
 * Reduces operator support load — customers can check their
 * cargo parcels, POS purchase history, loyalty points, and cargo
 * wallet without calling the shop.
 *
 *   POST /me/request-otp  — sends a 6-digit code via Beem SMS
 *   POST /me/verify-otp   — exchanges code for a 24h signed token
 *   GET  /me/dashboard    — needs the token; returns aggregated data
 *
 * OTP storage: in-memory Map with 5-min TTL. Single-instance only;
 * if you scale out, swap for Redis. The trade-off is acceptable
 * because OTPs are short-lived and a missed code just means the
 * customer re-requests it.
 */
interface OtpEntry { code: string; expiresAt: number; attempts: number }
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const PORTAL_TOKEN_TTL = '24h';

export interface PortalDashboard {
  phone: string;
  cargoCustomer: { displayId: string; name: string; balance: number; currency: string } | null;
  loyalty:       { points: number; tier?: string | null } | null;
  parcels: Array<{
    parcelId: string;
    description: string;
    destination: string;
    weight: number;
    lifecycleStatus: string;
    preAlertedAt?: string | null;
    externalTracking?: string | null;
    createdAt: string;
  }>;
  /** Kobe Mzigo (TZ ground cargo) parcels — surfaces here when the
   *  customer's phone matches an owner OR recipient on a waybill. */
  mzigoParcels: Array<{
    waybill: string;
    role: 'owner' | 'recipient' | 'packager';
    ownerName: string;
    recipientName: string;
    origin: string;
    destination: string;
    status: string;
    goodsType: string;
    weightKg: number;
    createdAt: string;
  }>;
  recentOrders: Array<{
    orderNumber: string;
    total: number;
    currency: string;
    createdAt: string;
    itemCount: number;
    items: Array<{ productName: string; quantity: number; unitPrice: number }>;
  }>;
}

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);
  private readonly otps = new Map<string, OtpEntry>();

  constructor(
    @InjectRepository(Parcel)         private readonly parcels:        Repository<Parcel>,
    @InjectRepository(PosOrder)       private readonly orders:         Repository<PosOrder>,
    @InjectRepository(PosOrderItem)   private readonly orderItems:     Repository<PosOrderItem>,
    @InjectRepository(CargoCustomer)  private readonly cargoCustomers: Repository<CargoCustomer>,
    @InjectRepository(LoyaltyCustomer) private readonly loyaltyCustomers: Repository<LoyaltyCustomer>,
    @InjectRepository(MzigoParcel)    private readonly mzigoParcels: Repository<MzigoParcel>,
    private readonly beem: BeemService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Normalize to MSISDN digits — same logic as BeemService so OTP
   *  lookups match no matter how the phone was originally typed. */
  private normalize(raw: string): string {
    return BeemService.normalizePhone(raw) ?? '';
  }

  async requestOtp(phone: string): Promise<{ sent: boolean }> {
    const dest = this.normalize(phone);
    if (!dest) throw new BadRequestException('Invalid phone number');

    const code = String(Math.floor(100_000 + Math.random() * 899_999));
    this.otps.set(dest, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
    this.logger.log(`OTP issued for ${dest.slice(-4)} (expires in 5 min)`);

    const message = `Your KobeOS verification code is ${code}. Valid for 5 minutes. Don't share this code with anyone.`;
    const result = await this.beem.sendSms(dest, message);
    return { sent: result.ok };
  }

  async verifyOtp(phone: string, code: string): Promise<{ token: string; phone: string }> {
    const dest = this.normalize(phone);
    const entry = this.otps.get(dest);
    if (!entry) throw new UnauthorizedException('No active code — request a new one');
    if (Date.now() > entry.expiresAt) {
      this.otps.delete(dest);
      throw new UnauthorizedException('Code expired — request a new one');
    }
    entry.attempts++;
    if (entry.attempts > OTP_MAX_ATTEMPTS) {
      this.otps.delete(dest);
      throw new UnauthorizedException('Too many attempts — request a new code');
    }
    if (entry.code !== code.trim()) {
      throw new UnauthorizedException(`Wrong code (${OTP_MAX_ATTEMPTS - entry.attempts} attempts left)`);
    }
    this.otps.delete(dest);
    const token = await this.jwt.signAsync(
      { sub: dest, kind: 'customer-portal' },
      { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn: PORTAL_TOKEN_TTL },
    );
    return { token, phone: dest };
  }

  /** Verify a portal token and return the phone it's bound to. Called
   *  from a tiny custom guard on the dashboard endpoint. */
  async verifyToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; kind: string }>(
        token,
        { secret: this.config.getOrThrow<string>('JWT_SECRET') },
      );
      if (payload.kind !== 'customer-portal') throw new UnauthorizedException('Wrong token kind');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired customer token');
    }
  }

  async dashboard(phone: string): Promise<PortalDashboard> {
    const dest = this.normalize(phone);
    // Look up the customer across every owner that has them — a phone
    // is the natural cross-tenant key for the self-serve view since
    // one customer might shop at multiple KobeOS-using stores.
    const [cargoCustomers, loyaltyRows, parcels, orders, mzigoRows] = await Promise.all([
      this.cargoCustomers.createQueryBuilder('c')
        .where('c.phone IS NOT NULL')
        .getMany()
        .then((rows) => rows.filter((c) => BeemService.normalizePhone(c.phone) === dest)),
      this.loyaltyCustomers.createQueryBuilder('l')
        .where('l.phone IS NOT NULL')
        .getMany()
        .then((rows) => rows.filter((c) => BeemService.normalizePhone(c.phone ?? '') === dest)),
      this.parcels.createQueryBuilder('p')
        .where('p.ownerPhone IS NOT NULL')
        .orderBy('p.createdAt', 'DESC')
        .limit(50)
        .getMany()
        .then((rows) => rows.filter((p) => BeemService.normalizePhone(p.ownerPhone) === dest)),
      this.orders.createQueryBuilder('o')
        .where('o.customerPhone IS NOT NULL')
        .orderBy('o.createdAt', 'DESC')
        .limit(20)
        .getMany()
        .then((rows) => rows.filter((o) => BeemService.normalizePhone(o.customerPhone ?? '') === dest)),
      // Mzigo parcels — the phone may match as owner, recipient, OR
      // packager. We tag the role on each row so the UI can label
      // them ("Yours" vs "Coming to you" vs "You packed this").
      this.mzigoParcels.createQueryBuilder('m')
        .orderBy('m.createdAt', 'DESC')
        .limit(100)
        .getMany()
        .then((rows) => rows
          .map((m) => {
            if (BeemService.normalizePhone(m.ownerPhone) === dest)     return { m, role: 'owner' as const };
            if (BeemService.normalizePhone(m.recipientPhone) === dest) return { m, role: 'recipient' as const };
            if (BeemService.normalizePhone(m.packagerPhone) === dest)  return { m, role: 'packager' as const };
            return null;
          })
          .filter((x): x is { m: MzigoParcel; role: 'owner' | 'recipient' | 'packager' } => x !== null)),
    ]);

    const cargoCustomer = cargoCustomers[0]
      ? {
          displayId: cargoCustomers[0].displayId,
          name: cargoCustomers[0].name,
          balance: Number(cargoCustomers[0].balance),
          currency: cargoCustomers[0].currency,
        }
      : null;

    const loyalty = loyaltyRows[0]
      ? {
          points: (loyaltyRows[0] as { points: number }).points ?? 0,
          tier: (loyaltyRows[0] as { tier?: string }).tier ?? null,
        }
      : null;

    // Fetch order items for the recent orders so the customer sees what
    // they bought, not just totals.
    const orderIds = orders.map((o) => o.id);
    const items = orderIds.length
      ? await this.orderItems.find({ where: orderIds.map((id) => ({ orderId: id })) })
      : [];
    const itemsByOrder = new Map<string, PosOrderItem[]>();
    for (const it of items) {
      const arr = itemsByOrder.get(it.orderId) ?? [];
      arr.push(it);
      itemsByOrder.set(it.orderId, arr);
    }

    return {
      phone: dest,
      cargoCustomer,
      loyalty,
      parcels: parcels.map((p) => ({
        parcelId: p.parcelId,
        description: p.description,
        destination: p.destination,
        weight: Number(p.weight),
        lifecycleStatus: p.lifecycleStatus,
        preAlertedAt: p.preAlertedAt?.toISOString?.() ?? null,
        externalTracking: p.externalTracking ?? null,
        createdAt: p.createdAt?.toISOString?.() ?? new Date().toISOString(),
      })),
      mzigoParcels: mzigoRows.map(({ m, role }) => ({
        waybill: m.waybill,
        role,
        ownerName: m.ownerName,
        recipientName: m.recipientName,
        origin: m.origin,
        destination: m.destination,
        status: m.status,
        goodsType: m.goodsType,
        weightKg: Number(m.weightKg),
        createdAt: m.createdAt?.toISOString?.() ?? new Date().toISOString(),
      })),
      recentOrders: orders.map((o) => {
        const its = itemsByOrder.get(o.id) ?? [];
        return {
          orderNumber: o.orderNumber,
          total: Number(o.total),
          currency: o.currency,
          createdAt: o.createdAt?.toISOString?.() ?? new Date().toISOString(),
          itemCount: its.length,
          items: its.slice(0, 5).map((it) => ({
            productName: it.productName,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
        };
      }),
    };
  }
}
