import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CargoPayment, Shipment } from './cargo.entity';
import { PaymentCustomer, PaymentDeposit } from '../payments/kobepay.entity';
import { KobePayAuditEvent } from '../payments/kobepay-rbac.entity';
import { KobePayRbacService } from '../payments/kobepay-rbac.service';
import { CargoGateway } from './cargo.gateway';
import { IsEnum, IsNumber, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class PayCargoFreightDto {
  @IsUUID() customerId!: string;
  @IsUUID() shipmentId!: string;
  @IsUUID() requestId!: string;
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) @Max(1_000_000_000) amount!: number;
  @IsString() @MaxLength(8) currency!: string;
  @IsEnum(['SHIPPING', 'CUSTOMS']) purpose!: 'SHIPPING' | 'CUSTOMS';
}

/** Exact four-decimal ledger arithmetic; never infer a currency from a mixed balance. */
export function ledgerUnits(value: string | number): bigint {
  const raw = String(value);
  if (!/^\d+(\.\d{1,4})?$/.test(raw)) throw new BadRequestException('Invalid ledger amount');
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
}
const decimal = (units: bigint) => `${units / 10000n}.${String(units % 10000n).padStart(4, '0')}`;

@Injectable()
export class CargoKobePayService {
  constructor(private readonly ds: DataSource, private readonly rbac: KobePayRbacService, private readonly gateway: CargoGateway) {}

  private async actor(uid: string, pin?: string) {
    const actor = await this.rbac.resolveActor(uid, pin);
    if (pin && !actor) throw new ForbiddenException('Invalid KobePay cashier PIN');
    return actor;
  }

  private async currency(tx: EntityManager, uid: string, customerId: string) {
    const deposits = await tx.getRepository(PaymentDeposit).find({ where: { ownerId: uid, customerId }, select: ['currency', 'status'] });
    const currencies = [...new Set(deposits.map(d => d.currency.toUpperCase()))];
    if (currencies.length !== 1 || !deposits.some(d => d.status === 'Confirmed')) return null;
    return currencies[0];
  }

  async accounts(uid: string, pin?: string) {
    const actor = await this.actor(uid, pin);
    this.rbac.ensure(actor, 'customer.read');
    const rows = await this.ds.getRepository(PaymentCustomer).find({ where: { ownerId: uid }, select: ['id', 'name', 'phone', 'balance'], order: { name: 'ASC' } });
    return Promise.all(rows.map(async row => ({ ...row, currency: await this.currency(this.ds.manager, uid, row.id) })));
  }

  async pay(uid: string, dto: PayCargoFreightDto, pin?: string) {
    const actor = await this.actor(uid, pin);
    this.rbac.ensure(actor, 'allocation.create');
    const amount = ledgerUnits(dto.amount);
    if (amount <= 0n || amount > 10_000_000_000_000n) throw new BadRequestException('Amount is outside the permitted range');
    if (!['SHIPPING', 'CUSTOMS'].includes(dto.purpose)) throw new BadRequestException('Invalid freight purpose');
    const currency = dto.currency.toUpperCase();
    const reference = `KP-FRT:${dto.requestId}`;
    const result = await this.ds.transaction(async tx => {
      // Serialize replays, including retries using a different customer ID.
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${uid}:${reference}`]);
      const payments = tx.getRepository(CargoPayment);
      const existing = await payments.findOne({ where: { ownerId: uid, reference, method: 'KOBEPAY' } });
      if (existing) {
        let source: { customerId?: string } = {};
        try { source = JSON.parse(existing.notes); } catch { /* invalid legacy metadata is not a replay */ }
        if (source.customerId !== dto.customerId || existing.shipmentId !== dto.shipmentId || ledgerUnits(existing.amount) !== amount || existing.currency !== currency || existing.purpose !== dto.purpose || existing.status !== 'COMPLETED') {
          throw new ConflictException('This payment request was already used for a different payment');
        }
        return { payment: existing, created: false };
      }
      const shipment = await tx.getRepository(Shipment).findOne({ where: { id: dto.shipmentId, ownerId: uid } });
      if (!shipment) throw new NotFoundException('Shipment not found');
      if (shipment.status === 'CANCELLED') throw new BadRequestException('Cancelled shipments cannot receive freight payments');
      const customers = tx.getRepository(PaymentCustomer);
      const customer = await customers.findOne({ where: { id: dto.customerId, ownerId: uid }, lock: { mode: 'pessimistic_write' } });
      if (!customer) throw new NotFoundException('KobePay customer not found');
      const accountCurrency = await this.currency(tx, uid, customer.id);
      if (!accountCurrency) throw new BadRequestException('This account has unverified or mixed-currency funding. Reconcile its funding in KobePay first.');
      if (accountCurrency !== currency) throw new BadRequestException('Payment currency must match the funded account; no automatic FX conversion is performed');
      const balance = ledgerUnits(customer.balance);
      if (balance < amount) throw new BadRequestException('Insufficient funded KobePay balance');
      customer.balance = decimal(balance - amount) as unknown as number;
      await customers.save(customer);
      const payment = await payments.save(payments.create({
        ownerId: uid, shipmentId: shipment.id, parcelId: null,
        customerName: customer.name, customerPhone: customer.phone,
        amount: decimal(amount) as unknown as number, currency, purpose: dto.purpose,
        method: 'KOBEPAY', reference, status: 'COMPLETED',
        notes: JSON.stringify({ source: 'kobepay-balance', customerId: customer.id, requestId: dto.requestId }),
      }));
      await tx.getRepository(KobePayAuditEvent).save({
        ownerId: uid, actorUserId: actor?.id ?? null, actorName: actor?.name ?? 'owner', actorRole: actor?.role ?? 'Owner',
        action: 'cargo.freightPayment', resourceType: 'cargo-payment', resourceId: payment.id,
        metadata: { customerId: customer.id, shipmentId: shipment.id, amount: decimal(amount), currency, purpose: dto.purpose, requestId: dto.requestId },
      });
      return { payment, created: true };
    });
    if (result.created) { try { this.gateway.emitPayment(uid, result.payment); } catch { /* settled transaction is authoritative */ } }
    return result.payment;
  }
}
