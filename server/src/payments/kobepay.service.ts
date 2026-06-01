import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
      return this.repo.find({
        where: [
          { ownerId: uid, name: ILike(`%${q}%`) },
          { ownerId: uid, phone: ILike(`%${q}%`) },
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
    return this.ds.transaction(async (tx) => {
      const custRepo = tx.getRepository(PaymentCustomer);
      const depRepo = tx.getRepository(PaymentDeposit);
      const customer = await custRepo.findOne({ where: { id: dto.customerId, ownerId: uid } });
      if (!customer) throw new NotFoundException('Customer not found');

      const status = dto.status ?? 'Confirmed';

      // Compute collectedTzs from targetAmount × salesRate + serviceFee
      // when the caller didn't supply it explicitly. This is what the
      // owner dashboard sums for "Total Collected".
      const targetAmount = dto.targetAmount ?? 0;
      const salesRate = dto.salesRate ?? 0;
      const serviceFee = dto.serviceFee ?? 0;
      const computedCollected = parseFloat((targetAmount * salesRate + serviceFee).toFixed(4));
      const collectedTzs = dto.collectedTzs ?? (computedCollected > 0 ? computedCollected : 0);

      const deposit = await depRepo.save(
        depRepo.create({
          ownerId: uid,
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          amount: dto.amount,
          currency: dto.currency ?? 'USD',
          method: dto.method,
          reference: dto.reference ?? '',
          status,
          txnType: dto.txnType ?? 'Deposit',
          suppliers: dto.suppliers ?? null,
          targetCurrency: dto.targetCurrency ?? 'CNY',
          targetAmount,
          salesRate,
          collectedTzs,
          serviceFee,
          cashierName: dto.cashierName ?? '',
        }),
      );

      if (status === 'Confirmed') {
        customer.balance = parseFloat((Number(customer.balance) + dto.amount).toFixed(4));
        await custRepo.save(customer);
      }
      await this.rbac.record(uid, ctx, 'deposit.create', 'deposit', deposit.id, {
        customerId: customer.id, amount: dto.amount, currency: dto.currency,
        targetAmount: dto.targetAmount, salesRate: dto.salesRate, status,
      });
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
      const customer = await custRepo.findOne({ where: { id: d.customerId, ownerId: uid } });
      if (customer) {
        const delta = dto.status === 'Confirmed' ? Number(d.amount) : -Number(d.amount);
        customer.balance = parseFloat((Number(customer.balance) + delta).toFixed(4));
        await custRepo.save(customer);
      }
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
        const supplier = await supRepo.findOne({ where: { id: p.supplierId, ownerId: uid } });
        if (supplier) {
          supplier.balance = parseFloat((Number(supplier.balance) + Number(p.amount)).toFixed(4));
          supplier.orders = Number(supplier.orders) + 1;
          await supRepo.save(supplier);
        }
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

      if (Number(customer.balance) < dto.amount) {
        throw new BadRequestException(
          `Insufficient customer balance: have ${Number(customer.balance).toFixed(2)}, need ${dto.amount.toFixed(2)}`,
        );
      }
      customer.balance = parseFloat((Number(customer.balance) - dto.amount).toFixed(4));
      await custRepo.save(customer);

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
