import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import {
  PaymentAllocation,
  PaymentCustomer,
  PaymentDeposit,
  PaymentPayout,
  PaymentSupplier,
  PayoutStatus,
} from './kobepay.entity';
import {
  ConfirmDepositDto,
  CreateAllocationDto,
  CreateDepositDto,
  CreatePayoutDto,
  UpdateCustomerDto,
  UpdatePayoutStatusDto,
  UpdateSupplierDto,
  UpsertCustomerDto,
  UpsertSupplierDto,
} from './dto/kobepay.dto';
import { KobePayRbacService, AuditContext } from './kobepay-rbac.service';
import { KobePayRatesService } from './kobepay-rate.service';
import { KobepayDispatcherService } from './kobepay-dispatcher.service';
import { KobepayRetryQueueService } from './kobepay-retry.service';
import { JournalService } from '../erp/journal.service';

/** Anything within ±0.5% of the house rate counts as "matching" — small
 *  rounding differences from typing a rounded UI value shouldn't trip
 *  the override gate. */
const RATE_TOLERANCE_PCT = 0.5;

/** Escape LIKE wildcards in user-supplied search input so a customer
 *  typing "%" or "_" doesn't expand to an unbounded scan. */
function escapeLikeWildcards(q: string): string {
  return q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function divergesFromHouse(supplied: number, house: number): boolean {
  if (house <= 0) return false;
  const diff = Math.abs((supplied - house) / house) * 100;
  return diff > RATE_TOLERANCE_PCT;
}

/* ── Customers ───────────────────────────────────────────── */
@Injectable()
export class KobePayCustomersService {
  constructor(
    @InjectRepository(PaymentCustomer) private readonly repo: Repository<PaymentCustomer>,
    private readonly rbac: KobePayRbacService,
  ) {}

  async list(uid: string, ctx: AuditContext, q?: string) {
    this.rbac.ensure(ctx.user ?? null, 'customer.read');
    if (q && q.trim()) {
      const safe = escapeLikeWildcards(q.trim());
      return this.repo.find({
        where: [
          { ownerId: uid, name: ILike(`%${safe}%`) },
          { ownerId: uid, phone: ILike(`%${safe}%`) },
        ],
        order: { name: 'ASC' },
      });
    }
    return this.repo.find({ where: { ownerId: uid }, order: { name: 'ASC' } });
  }

  async byPhone(uid: string, ctx: AuditContext, phone: string) {
    this.rbac.ensure(ctx.user ?? null, 'customer.read');
    const c = await this.repo.findOne({ where: { ownerId: uid, phone } });
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  async upsert(uid: string, ctx: AuditContext, dto: UpsertCustomerDto) {
    const existing = await this.repo.findOne({ where: { ownerId: uid, phone: dto.phone } });
    if (existing) {
      this.rbac.ensure(ctx.user ?? null, 'customer.update');
      Object.assign(existing, dto);
      const saved = await this.repo.save(existing);
      await this.rbac.record(uid, ctx, 'customer.update', 'customer', saved.id, { phone: saved.phone });
      return saved;
    }
    this.rbac.ensure(ctx.user ?? null, 'customer.create');
    const saved = await this.repo.save(this.repo.create({ ...dto, ownerId: uid }));
    await this.rbac.record(uid, ctx, 'customer.create', 'customer', saved.id, { phone: saved.phone });
    return saved;
  }

  async update(uid: string, ctx: AuditContext, id: string, dto: UpdateCustomerDto) {
    this.rbac.ensure(ctx.user ?? null, 'customer.update');
    const c = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!c) throw new NotFoundException();
    Object.assign(c, dto);
    const saved = await this.repo.save(c);
    await this.rbac.record(uid, ctx, 'customer.update', 'customer', saved.id, dto);
    return saved;
  }

  async remove(uid: string, ctx: AuditContext, id: string) {
    this.rbac.ensure(ctx.user ?? null, 'customer.delete');
    const c = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!c) throw new NotFoundException();
    await this.repo.remove(c);
    await this.rbac.record(uid, ctx, 'customer.delete', 'customer', id, null);
    return { id };
  }
}

/* ── Suppliers ───────────────────────────────────────────── */
@Injectable()
export class KobePaySuppliersService {
  constructor(
    @InjectRepository(PaymentSupplier) private readonly repo: Repository<PaymentSupplier>,
    private readonly rbac: KobePayRbacService,
  ) {}

  list(uid: string, ctx: AuditContext) {
    this.rbac.ensure(ctx.user ?? null, 'supplier.read');
    return this.repo.find({ where: { ownerId: uid }, order: { name: 'ASC' } });
  }

  async create(uid: string, ctx: AuditContext, dto: UpsertSupplierDto) {
    this.rbac.ensure(ctx.user ?? null, 'supplier.create');
    const saved = await this.repo.save(this.repo.create({ ...dto, ownerId: uid }));
    await this.rbac.record(uid, ctx, 'supplier.create', 'supplier', saved.id, { name: saved.name });
    return saved;
  }

  async update(uid: string, ctx: AuditContext, id: string, dto: UpdateSupplierDto) {
    this.rbac.ensure(ctx.user ?? null, 'supplier.update');
    const s = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!s) throw new NotFoundException();
    Object.assign(s, dto);
    const saved = await this.repo.save(s);
    await this.rbac.record(uid, ctx, 'supplier.update', 'supplier', saved.id, dto);
    return saved;
  }

  async remove(uid: string, ctx: AuditContext, id: string) {
    this.rbac.ensure(ctx.user ?? null, 'supplier.delete');
    const s = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!s) throw new NotFoundException();
    await this.repo.remove(s);
    await this.rbac.record(uid, ctx, 'supplier.delete', 'supplier', id, null);
    return { id };
  }
}

/* ── Deposits ────────────────────────────────────────────── */
@Injectable()
export class KobePayDepositsService {
  constructor(
    @InjectRepository(PaymentDeposit) private readonly deposits: Repository<PaymentDeposit>,
    @InjectRepository(PaymentCustomer) private readonly customers: Repository<PaymentCustomer>,
    private readonly ds: DataSource,
    private readonly rbac: KobePayRbacService,
    private readonly rates: KobePayRatesService,
    private readonly dispatcher: KobepayDispatcherService,
    private readonly retryQueue: KobepayRetryQueueService,
    private readonly journal: JournalService,
  ) {}

  list(uid: string) {
    return this.deposits.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  /**
   * Record a deposit. Confirmed deposits bump the customer's running
   * balance atomically; pending deposits only persist the row. The
   * customer must already exist (so phone-lookup stays a real lookup,
   * not a side-effecting upsert).
   */
  async create(uid: string, ctx: AuditContext, dto: CreateDepositDto) {
    this.rbac.ensure(ctx.user ?? null, 'deposit.create');

    // Hard rate-override gate: if a house sales rate exists for this
    // (targetCurrency -> TZS) pair and the caller's salesRate diverges
    // beyond tolerance, require the rate.override permission.
    if (dto.salesRate && dto.salesRate > 0) {
      const targetCcy = dto.targetCurrency ?? 'CNY';
      const house = await this.rates.currentRate(uid, targetCcy, 'TZS');
      if (house && divergesFromHouse(dto.salesRate, Number(house.salesRate))) {
        try {
          this.rbac.ensure(ctx.user ?? null, 'rate.override');
        } catch {
          await this.rbac.record(uid, ctx, 'rate.overrideDenied', 'deposit', null, {
            attempted: dto.salesRate, house: Number(house.salesRate), pair: `${targetCcy}->TZS`,
          });
          throw new ForbiddenException(
            `Sales rate ${dto.salesRate} diverges from house rate ${house.salesRate}; requires rate.override permission`,
          );
        }
        await this.rbac.record(uid, ctx, 'rate.override', 'deposit', null, {
          field: 'salesRate', attempted: dto.salesRate, house: Number(house.salesRate), pair: `${targetCcy}->TZS`,
        });
      }
    }

    return this.ds.transaction(async (tx) => {
      const custRepo = tx.getRepository(PaymentCustomer);
      const depRepo = tx.getRepository(PaymentDeposit);
      const customer = await custRepo.findOne({ where: { id: dto.customerId, ownerId: uid } });
      if (!customer) throw new NotFoundException('Customer not found');

      const status = dto.status ?? 'Confirmed';
      const cashCurrency = (dto.cashCurrency ?? dto.currency ?? 'USD').toUpperCase();
      const targetCurrency = (dto.targetCurrency ?? 'CNY').toUpperCase();
      const serviceFee = dto.serviceFee ?? 0;

      // Lock the customer's USD-denominated intent. If the cashier paid
      // USD cash, that IS the intent. If they paid TZS cash, derive USD
      // intent from the public USD→TZS rate so the supplier's CNY
      // delivery amount is locked regardless of later rate moves.
      let quoteUsd = dto.quoteUsd ?? 0;
      if (quoteUsd === 0) {
        if (cashCurrency === 'USD') {
          quoteUsd = Number(dto.amount);
        } else if (cashCurrency === 'TZS') {
          const r = await this.rates.currentRate(uid, 'USD', 'TZS');
          if (r && r.salesRate > 0) {
            quoteUsd = parseFloat((Number(dto.amount) / r.salesRate).toFixed(4));
          }
        }
      }

      // Lock the supplier's receive amount in targetCurrency. If the
      // cashier supplied targetAmount explicitly use that; otherwise
      // derive from the USD intent at the public USD→target rate.
      let targetAmount = dto.targetAmount ?? 0;
      if (targetAmount === 0 && quoteUsd > 0 && targetCurrency !== 'USD') {
        const r = await this.rates.currentRate(uid, 'USD', targetCurrency);
        if (r && r.salesRate > 0) {
          targetAmount = parseFloat((quoteUsd * r.salesRate).toFixed(4));
        }
      } else if (targetAmount === 0 && targetCurrency === 'USD') {
        targetAmount = quoteUsd;
      }

      // Sales rate (target → TZS) and collected TZS lock together with
      // the deposit row so the receipt and the owner dashboard see the
      // exact numbers the customer transacted at.
      let salesRate = dto.salesRate ?? 0;
      if (salesRate === 0 && targetCurrency !== 'TZS') {
        const r = await this.rates.currentRate(uid, targetCurrency, 'TZS');
        if (r && r.salesRate > 0) salesRate = r.salesRate;
      }
      let collectedTzs = dto.collectedTzs ?? 0;
      if (collectedTzs === 0) {
        if (cashCurrency === 'TZS') {
          collectedTzs = parseFloat((Number(dto.amount) + serviceFee).toFixed(4));
        } else if (targetAmount > 0 && salesRate > 0) {
          collectedTzs = parseFloat((targetAmount * salesRate + serviceFee).toFixed(4));
        } else if (quoteUsd > 0) {
          const r = await this.rates.currentRate(uid, 'USD', 'TZS');
          if (r && r.salesRate > 0) {
            collectedTzs = parseFloat((quoteUsd * r.salesRate + serviceFee).toFixed(4));
          }
        }
      }

      const deposit = await depRepo.save(
        depRepo.create({
          ownerId: uid,
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          amount: dto.amount,
          currency: dto.currency ?? cashCurrency,
          method: dto.method,
          reference: dto.reference ?? '',
          status,
          txnType: dto.txnType ?? 'Deposit',
          suppliers: dto.suppliers ?? null,
          targetCurrency,
          targetAmount,
          salesRate,
          collectedTzs,
          serviceFee,
          cashierName: dto.cashierName ?? '',
          quoteUsd,
          cashCurrency,
          supplierCity: dto.supplierCity ?? '',
        }),
      );

      if (status === 'Confirmed') {
        await custRepo
          .createQueryBuilder()
          .update(PaymentCustomer)
          .set({ balance: () => `balance + ${dto.amount}` })
          .where('id = :id AND "ownerId" = :uid', { id: customer.id, uid })
          .execute();
      }
      // GL: confirmed deposits hit KobePay's books inside the same tx
      // so the books never drift from the ledger (a failed journal post
      // rolls back the entire deposit).
      if (status === 'Confirmed') {
        await this.journal.postKobepayDepositConfirmedInTransaction(tx, uid, deposit);
      }
      await this.rbac.record(uid, ctx, 'deposit.create', 'deposit', deposit.id, {
        customerId: customer.id, amount: dto.amount, currency: dto.currency,
        targetAmount: dto.targetAmount, salesRate: dto.salesRate, status,
      });
      return { deposit, customer };
    }).then(async ({ deposit, customer }) => {
      // Model 2: KobePay pushes a receipt to the client's ERP install
      // when the deposit is Confirmed AND the client has an endpoint
      // configured. Best-effort; failure is audited but doesn't unwind
      // the deposit (the client can pull the receipt manually later).
      if (deposit.status === 'Confirmed' && customer.erpEndpointUrl && customer.erpApiKey) {
        const result = await this.dispatcher.dispatchDeposit(
          customer, deposit, ctx.user?.name ?? 'KobePay',
        );
        await this.rbac.record(
          uid, ctx,
          result.ok ? 'deposit.dispatched' : 'deposit.dispatchFailed',
          'deposit', deposit.id,
          { endpoint: customer.erpEndpointUrl, ok: result.ok, status: result.status, error: result.error },
        );
        if (result.ok) {
          await this.retryQueue.recordSuccess(uid, deposit, customer, result.payload as unknown as Record<string, unknown>, result.status ?? 200);
        } else {
          await this.retryQueue.enqueueFailure(uid, deposit, customer, result.payload as unknown as Record<string, unknown>, {
            status: result.status, error: result.error ?? 'unknown',
          });
        }
      }
      return deposit;
    });
  }

  /**
   * Promote a pending deposit to confirmed (or vice versa). Adjusts the
   * customer balance to match the new state.
   */
  async setStatus(uid: string, ctx: AuditContext, id: string, dto: ConfirmDepositDto) {
    this.rbac.ensure(ctx.user ?? null, 'deposit.confirm');
    return this.ds.transaction(async (tx) => {
      const depRepo = tx.getRepository(PaymentDeposit);
      const custRepo = tx.getRepository(PaymentCustomer);
      const d = await depRepo.findOne({ where: { id, ownerId: uid } });
      if (!d) throw new NotFoundException();

      if (d.status === dto.status) return d;
      const delta = dto.status === 'Confirmed' ? Number(d.amount) : -Number(d.amount);
      await custRepo
        .createQueryBuilder()
        .update(PaymentCustomer)
        .set({ balance: () => `balance + ${delta}` })
        .where('id = :id AND "ownerId" = :uid', { id: d.customerId, uid })
        .execute();
      d.status = dto.status;
      const saved = await depRepo.save(d);
      await this.rbac.record(uid, ctx, 'deposit.statusChange', 'deposit', saved.id, { to: dto.status });
      return saved;
    });
  }
}

/* ── Payouts ─────────────────────────────────────────────── */
const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  INITIATED: ['SENT', 'REJECTED'],
  SENT: ['CONFIRMED', 'REJECTED'],
  CONFIRMED: ['PAID', 'REJECTED'],
  PAID: [],
  REJECTED: [],
};

@Injectable()
export class KobePayPayoutsService {
  constructor(
    @InjectRepository(PaymentPayout) private readonly payouts: Repository<PaymentPayout>,
    @InjectRepository(PaymentSupplier) private readonly suppliers: Repository<PaymentSupplier>,
    private readonly ds: DataSource,
    private readonly rbac: KobePayRbacService,
    private readonly rates: KobePayRatesService,
    private readonly journal: JournalService,
  ) {}

  list(uid: string) {
    return this.payouts.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  async create(uid: string, ctx: AuditContext, dto: CreatePayoutDto) {
    this.rbac.ensure(ctx.user ?? null, 'payout.create');
    return this.ds.transaction(async (tx) => {
      const supRepo = tx.getRepository(PaymentSupplier);
      const payRepo = tx.getRepository(PaymentPayout);
      const supplier = await supRepo.findOne({ where: { id: dto.supplierId, ownerId: uid } });
      if (!supplier) throw new NotFoundException('Supplier not found');
      const saved = await payRepo.save(
        payRepo.create({
          ownerId: uid,
          supplierId: supplier.id,
          supplierName: supplier.name,
          amount: dto.amount,
          currency: dto.currency ?? 'CNY',
          method: dto.method,
          status: 'INITIATED',
          initiatedBy: dto.initiatedBy ?? ctx.user?.name ?? '',
          confirmedBy: '',
          notes: dto.notes ?? '',
          depositId: dto.depositId ?? null,
          actualRate: dto.actualRate ?? 0,
          actualCostTzs: dto.actualCostTzs ?? 0,
          transactionFees: dto.transactionFees ?? 0,
          bankCharges: dto.bankCharges ?? 0,
          mobileMoneyCharges: dto.mobileMoneyCharges ?? 0,
          agentCommission: dto.agentCommission ?? 0,
        }),
      );
      await this.rbac.record(uid, ctx, 'payout.create', 'payout', saved.id, {
        supplierId: supplier.id, amount: dto.amount, currency: dto.currency, depositId: dto.depositId,
      });
      return saved;
    });
  }

  /**
   * Advance the payout through the lifecycle. PAID is terminal and bumps
   * the supplier's lifetime balance + order count. REJECTED is terminal
   * with no balance change. Illegal transitions return 400.
   */
  async updateStatus(uid: string, ctx: AuditContext, id: string, dto: UpdatePayoutStatusDto) {
    // Permission per target state — markPaid is the cashier-China gate.
    const perm = dto.status === 'PAID' ? 'payout.markPaid'
               : dto.status === 'CONFIRMED' ? 'payout.confirm'
               : 'payout.advance';
    this.rbac.ensure(ctx.user ?? null, perm);

    // Rate-override gate on the PAID transition: if the caller is
    // entering an actualRate that diverges from the house cost rate,
    // require rate.override (so Cashier China can't quietly pocket the
    // spread by booking a higher cost than what they actually paid).
    if (dto.status === 'PAID' && dto.actualRate && dto.actualRate > 0) {
      const existing = await this.payouts.findOne({ where: { id, ownerId: uid } });
      const ccy = existing?.currency ?? 'CNY';
      const house = await this.rates.currentRate(uid, ccy, 'TZS');
      if (house && divergesFromHouse(dto.actualRate, Number(house.costRate))) {
        try {
          this.rbac.ensure(ctx.user ?? null, 'rate.override');
        } catch {
          await this.rbac.record(uid, ctx, 'rate.overrideDenied', 'payout', id, {
            attempted: dto.actualRate, house: Number(house.costRate), pair: `${ccy}->TZS`,
          });
          throw new ForbiddenException(
            `Actual cost rate ${dto.actualRate} diverges from house cost rate ${house.costRate}; requires rate.override permission`,
          );
        }
        await this.rbac.record(uid, ctx, 'rate.override', 'payout', id, {
          field: 'actualRate', attempted: dto.actualRate, house: Number(house.costRate), pair: `${ccy}->TZS`,
        });
      }
    }
    return this.ds.transaction(async (tx) => {
      const payRepo = tx.getRepository(PaymentPayout);
      const supRepo = tx.getRepository(PaymentSupplier);
      const p = await payRepo.findOne({ where: { id, ownerId: uid } });
      if (!p) throw new NotFoundException();
      const allowed = PAYOUT_TRANSITIONS[p.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(`Cannot transition payout from ${p.status} to ${dto.status}`);
      }
      p.status = dto.status;
      if (dto.confirmedBy !== undefined) p.confirmedBy = dto.confirmedBy;
      if (dto.notes !== undefined) p.notes = dto.notes;

      // Cashier China confirms the actual cost + fees on the PAID
      // transition; these flip the linked deposit's profit from
      // "Projected" to "Realized" on the owner dashboard.
      if (dto.actualRate !== undefined) p.actualRate = dto.actualRate;
      if (dto.actualCostTzs !== undefined) p.actualCostTzs = dto.actualCostTzs;
      if (dto.transactionFees !== undefined) p.transactionFees = dto.transactionFees;
      if (dto.bankCharges !== undefined) p.bankCharges = dto.bankCharges;
      if (dto.mobileMoneyCharges !== undefined) p.mobileMoneyCharges = dto.mobileMoneyCharges;
      if (dto.agentCommission !== undefined) p.agentCommission = dto.agentCommission;

      // If PAID-transitioning and no explicit actualCost was supplied
      // but we have an actualRate, derive cost from amount × rate so
      // the simple flow (cashier just enters the rate) still works.
      if (dto.status === 'PAID' && Number(p.actualCostTzs) === 0 && Number(p.actualRate) > 0) {
        p.actualCostTzs = parseFloat((Number(p.amount) * Number(p.actualRate)).toFixed(4));
      }

      if (dto.status === 'PAID') {
        const amt = Number(p.amount);
        await supRepo
          .createQueryBuilder()
          .update(PaymentSupplier)
          .set({
            balance: () => `balance + ${amt}`,
            orders: () => `orders + 1`,
          })
          .where('id = :id AND "ownerId" = :uid', { id: p.supplierId, uid })
          .execute();
        // GL: close out customer deposit liability, book real China cash
        // out, exchange P&L, and any fee expenses inside the same tx.
        const depRepo = tx.getRepository(PaymentDeposit);
        const linkedDeposit = p.depositId
          ? await depRepo.findOne({ where: { id: p.depositId, ownerId: uid } })
          : null;
        await this.journal.postKobepayPayoutPaidInTransaction(tx, uid, p, linkedDeposit);
      }
      const saved = await payRepo.save(p);
      await this.rbac.record(uid, ctx, `payout.${dto.status.toLowerCase()}`, 'payout', saved.id, {
        actualRate: dto.actualRate, actualCostTzs: saved.actualCostTzs, fees: {
          bankCharges: dto.bankCharges, mobileMoneyCharges: dto.mobileMoneyCharges,
          transactionFees: dto.transactionFees, agentCommission: dto.agentCommission,
        },
      });
      return saved;
    });
  }
}

/* ── Allocations (customer balance → supplier order) ─────── */
@Injectable()
export class KobePayAllocationsService {
  constructor(
    @InjectRepository(PaymentAllocation) private readonly allocations: Repository<PaymentAllocation>,
    @InjectRepository(PaymentCustomer) private readonly customers: Repository<PaymentCustomer>,
    @InjectRepository(PaymentSupplier) private readonly suppliers: Repository<PaymentSupplier>,
    private readonly ds: DataSource,
    private readonly rbac: KobePayRbacService,
  ) {}

  list(uid: string) {
    return this.allocations.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  /**
   * Allocate part of a customer's balance to a supplier order. Decrements
   * the customer's balance; the order is what eventually triggers a payout
   * on the China side. Insufficient balance returns 400.
   */
  async create(uid: string, ctx: AuditContext, dto: CreateAllocationDto) {
    this.rbac.ensure(ctx.user ?? null, 'allocation.create');
    return this.ds.transaction(async (tx) => {
      const allocRepo = tx.getRepository(PaymentAllocation);
      const custRepo = tx.getRepository(PaymentCustomer);
      const supRepo = tx.getRepository(PaymentSupplier);

      const customer = await custRepo.findOne({ where: { id: dto.customerId, ownerId: uid } });
      if (!customer) throw new NotFoundException('Customer not found');
      const supplier = await supRepo.findOne({ where: { id: dto.supplierId, ownerId: uid } });
      if (!supplier) throw new NotFoundException('Supplier not found');

      // Atomic balance-check-and-decrement so two concurrent allocations
      // can't both pass the check against the same balance, then both
      // succeed and leave the customer negative.
      const ok = await custRepo
        .createQueryBuilder()
        .update(PaymentCustomer)
        .set({ balance: () => `balance - ${dto.amount}` })
        .where('id = :id AND "ownerId" = :uid AND balance >= :amt', {
          id: customer.id, uid, amt: dto.amount,
        })
        .execute();
      if (ok.affected === 0) {
        const refreshed = await custRepo.findOne({ where: { id: customer.id, ownerId: uid } });
        const have = refreshed ? Number(refreshed.balance) : 0;
        throw new BadRequestException(
          `Insufficient customer balance: have ${have.toFixed(2)}, need ${dto.amount.toFixed(2)}`,
        );
      }

      const saved = await allocRepo.save(
        allocRepo.create({
          ownerId: uid,
          customerId: customer.id,
          customerName: customer.name,
          supplierId: supplier.id,
          supplierName: supplier.name,
          amount: dto.amount,
          orderRef: dto.orderRef,
          type: dto.type ?? 'Deposit',
        }),
      );
      await this.rbac.record(uid, ctx, 'allocation.create', 'allocation', saved.id, {
        customerId: customer.id, supplierId: supplier.id, amount: dto.amount,
      });
      return saved;
    });
  }
}
