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

/* ── Customers ───────────────────────────────────────────── */
@Injectable()
export class KobePayCustomersService {
  constructor(@InjectRepository(PaymentCustomer) private readonly repo: Repository<PaymentCustomer>) {}

  list(uid: string, q?: string) {
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

  async byPhone(uid: string, phone: string) {
    const c = await this.repo.findOne({ where: { ownerId: uid, phone } });
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  async upsert(uid: string, dto: UpsertCustomerDto) {
    const existing = await this.repo.findOne({ where: { ownerId: uid, phone: dto.phone } });
    if (existing) {
      Object.assign(existing, dto);
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ ...dto, ownerId: uid }));
  }

  async update(uid: string, id: string, dto: UpdateCustomerDto) {
    const c = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!c) throw new NotFoundException();
    Object.assign(c, dto);
    return this.repo.save(c);
  }

  async remove(uid: string, id: string) {
    const c = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!c) throw new NotFoundException();
    await this.repo.remove(c);
    return { id };
  }
}

/* ── Suppliers ───────────────────────────────────────────── */
@Injectable()
export class KobePaySuppliersService {
  constructor(@InjectRepository(PaymentSupplier) private readonly repo: Repository<PaymentSupplier>) {}

  list(uid: string) {
    return this.repo.find({ where: { ownerId: uid }, order: { name: 'ASC' } });
  }

  async create(uid: string, dto: UpsertSupplierDto) {
    return this.repo.save(this.repo.create({ ...dto, ownerId: uid }));
  }

  async update(uid: string, id: string, dto: UpdateSupplierDto) {
    const s = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!s) throw new NotFoundException();
    Object.assign(s, dto);
    return this.repo.save(s);
  }

  async remove(uid: string, id: string) {
    const s = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!s) throw new NotFoundException();
    await this.repo.remove(s);
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
  async create(uid: string, dto: CreateDepositDto) {
    return this.ds.transaction(async (tx) => {
      const custRepo = tx.getRepository(PaymentCustomer);
      const depRepo = tx.getRepository(PaymentDeposit);
      const customer = await custRepo.findOne({ where: { id: dto.customerId, ownerId: uid } });
      if (!customer) throw new NotFoundException('Customer not found');

      const status = dto.status ?? 'Confirmed';
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
        }),
      );

      if (status === 'Confirmed') {
        customer.balance = parseFloat((Number(customer.balance) + dto.amount).toFixed(4));
        await custRepo.save(customer);
      }
      return deposit;
    });
  }

  /**
   * Promote a pending deposit to confirmed (or vice versa). Adjusts the
   * customer balance to match the new state.
   */
  async setStatus(uid: string, id: string, dto: ConfirmDepositDto) {
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
      return depRepo.save(d);
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
  ) {}

  list(uid: string) {
    return this.payouts.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  async create(uid: string, dto: CreatePayoutDto) {
    return this.ds.transaction(async (tx) => {
      const supRepo = tx.getRepository(PaymentSupplier);
      const payRepo = tx.getRepository(PaymentPayout);
      const supplier = await supRepo.findOne({ where: { id: dto.supplierId, ownerId: uid } });
      if (!supplier) throw new NotFoundException('Supplier not found');
      return payRepo.save(
        payRepo.create({
          ownerId: uid,
          supplierId: supplier.id,
          supplierName: supplier.name,
          amount: dto.amount,
          currency: dto.currency ?? 'CNY',
          method: dto.method,
          status: 'INITIATED',
          initiatedBy: dto.initiatedBy ?? '',
          confirmedBy: '',
          notes: dto.notes ?? '',
        }),
      );
    });
  }

  /**
   * Advance the payout through the lifecycle. PAID is terminal and bumps
   * the supplier's lifetime balance + order count. REJECTED is terminal
   * with no balance change. Illegal transitions return 400.
   */
  async updateStatus(uid: string, id: string, dto: UpdatePayoutStatusDto) {
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

      if (dto.status === 'PAID') {
        const supplier = await supRepo.findOne({ where: { id: p.supplierId, ownerId: uid } });
        if (supplier) {
          supplier.balance = parseFloat((Number(supplier.balance) + Number(p.amount)).toFixed(4));
          supplier.orders = Number(supplier.orders) + 1;
          await supRepo.save(supplier);
        }
      }
      return payRepo.save(p);
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
  ) {}

  list(uid: string) {
    return this.allocations.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  /**
   * Allocate part of a customer's balance to a supplier order. Decrements
   * the customer's balance; the order is what eventually triggers a payout
   * on the China side. Insufficient balance returns 400.
   */
  async create(uid: string, dto: CreateAllocationDto) {
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

      return allocRepo.save(
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
    });
  }
}
