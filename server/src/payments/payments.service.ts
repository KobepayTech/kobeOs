import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreditLoan, PaymentTransaction, Wallet } from './payments.entity';
import { InboundPayment } from '../mobile-money/mobile-money.entity';
import { CreateLoanDto, CreateWalletDto, TransactionDto, TransferDto, UpdateLoanDto } from './dto/payments.dto';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class WalletsService {
  constructor(@InjectRepository(Wallet) private readonly repo: Repository<Wallet>) {}
  list(uid: string, page = 1, limit = 50) {
    return this.repo.find({ where: { ownerId: uid }, skip: (page - 1) * limit, take: limit });
  }
  async get(uid: string, id: string) {
    const w = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!w) throw new NotFoundException();
    return w;
  }
  create(uid: string, dto: CreateWalletDto) {
    return this.repo.save(this.repo.create({ ownerId: uid, currency: dto.currency ?? 'TZS' }));
  }
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(PaymentTransaction) private readonly txns: Repository<PaymentTransaction>,
    @InjectRepository(InboundPayment) private readonly inbound: Repository<InboundPayment>,
    private readonly ds: DataSource,
  ) {}

  /**
   * A CREDIT adds spendable balance, so it must correspond to money that
   * actually arrived. Until this check existed, any authenticated user could
   * POST /payments/transactions with type CREDIT and mint themselves an
   * arbitrary balance — the endpoint was guarded only by JwtAuthGuard.
   *
   * Two ways to satisfy it:
   *  - an operator with the admin role recording a manual adjustment, or
   *  - a reference naming a verified inbound mobile-money payment belonging
   *    to this owner, for the same amount and currency.
   *
   * mm_inbound_payments rows are created from SMS delivered by a device
   * holding a hashed gateway key, so they are evidence of a real payment
   * rather than something the caller can assert.
   */
  private async assertCreditIsFunded(
    uid: string,
    role: string | undefined,
    dto: TransactionDto,
    txAmount: number,
    walletCurrency: string,
  ): Promise<void> {
    if (role === 'admin') return;

    const reference = dto.reference?.trim();
    if (!reference) {
      throw new ForbiddenException(
        'A credit must reference a verified payment. Record the mobile-money reference, or ask an administrator to post a manual adjustment.',
      );
    }

    const payment = await this.inbound.findOne({
      where: { ownerId: uid, transactionId: reference },
    });
    if (!payment) {
      throw new ForbiddenException(`No verified payment found for reference '${reference}'.`);
    }
    // A failed or ignored SMS is not money received.
    if (!['RECEIVED', 'PROCESSED'].includes(payment.status)) {
      throw new ForbiddenException(`Payment '${reference}' is not settled (status ${payment.status}).`);
    }
    // The balance is held in the wallet's currency, so that is what the
    // payment has to be in — not whatever the request claimed.
    if (payment.currency !== walletCurrency) {
      throw new BadRequestException(
        `Payment '${reference}' is in ${payment.currency}, but the wallet is in ${walletCurrency}.`,
      );
    }
    // Crediting more than arrived is the same hole by a different route.
    if (Number(payment.amount) < txAmount) {
      throw new BadRequestException(
        `Payment '${reference}' was ${payment.amount} ${payment.currency}; cannot credit ${txAmount}.`,
      );
    }
    // One payment funds one credit. Without this, a single real payment could
    // be re-credited indefinitely.
    const alreadyUsed = await this.txns.findOne({
      where: { ownerId: uid, reference, type: 'CREDIT' },
    });
    if (alreadyUsed) {
      throw new ForbiddenException(`Payment '${reference}' has already been credited.`);
    }
  }

  list(uid: string, page = 1, limit = 50) {
    return this.txns.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
  }

  byWallet(uid: string, walletId: string, page = 1, limit = 50) {
    return this.txns.find({ where: { ownerId: uid, walletId }, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
  }

  async post(uid: string, dto: TransactionDto, role?: string) {
    // Idempotency lookup is owner-scoped: keys from owner A must never
    // alias to owner B's transactions, and must never block them either.
    if (dto.idempotencyKey) {
      const existing = await this.txns.findOne({
        where: { idempotencyKey: dto.idempotencyKey, ownerId: uid },
      });
      if (existing) return existing;
    }
    const txAmount = parseFloat(dto.amount as unknown as string);
    if (!(txAmount > 0)) throw new BadRequestException('Amount must be greater than zero');
    if (dto.type === 'CREDIT') {
      const wallet = await this.wallets.findOne({ where: { id: dto.walletId, ownerId: uid } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      await this.assertCreditIsFunded(uid, role, dto, txAmount, wallet.currency);
    }

    return this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(Wallet);
      const tRepo = tx.getRepository(PaymentTransaction);

      // Atomic balance change: SET balance = balance ± :amount under a
      // WHERE clause that enforces ownership AND, for debits, sufficient
      // funds. No read-modify-write window for concurrent writers to race
      // through, and the funds check is the same SQL statement as the
      // decrement so a debit can never overdraw.
      if (dto.type === 'CREDIT') {
        const ok = await wRepo
          .createQueryBuilder()
          .update(Wallet)
          .set({ balance: () => 'balance + :txAmount' })
          .setParameter('txAmount', txAmount)
          .where('id = :id AND "ownerId" = :uid', { id: dto.walletId, uid })
          .execute();
        if (ok.affected === 0) throw new NotFoundException('Wallet not found');
      } else if (dto.type === 'DEBIT') {
        const ok = await wRepo
          .createQueryBuilder()
          .update(Wallet)
          .set({ balance: () => 'balance - :txAmount' })
          .setParameter('txAmount', txAmount)
          .where('id = :id AND "ownerId" = :uid AND balance >= :amt', {
            id: dto.walletId, uid, amt: txAmount,
          })
          .execute();
        if (ok.affected === 0) {
          // Distinguish wallet-missing from insufficient-funds for clearer errors.
          const wallet = await wRepo.findOne({ where: { id: dto.walletId, ownerId: uid } });
          if (!wallet) throw new NotFoundException('Wallet not found');
          throw new BadRequestException('Insufficient funds');
        }
      }

      const wallet = await wRepo.findOne({ where: { id: dto.walletId, ownerId: uid } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      return tRepo.save(tRepo.create({
        ownerId: uid,
        walletId: wallet.id,
        type: dto.type,
        amount: dto.amount,
        currency: wallet.currency,
        status: 'COMPLETED',
        counterparty: dto.counterparty ?? null,
        reference: dto.reference ?? null,
        description: dto.description ?? '',
        idempotencyKey: dto.idempotencyKey ?? null,
      }));
    });
  }

  /**
   * Each leg of a transfer carries its own idempotency key, derived from the
   * caller's. Both legs used to be saved with the SAME key, which the
   * production migration's global unique index on idempotencyKey rejected —
   * so the second insert failed and the whole transfer rolled back. It only
   * worked on desktop and in CI, where the schema comes from synchronize and
   * has the entity's composite index instead.
   */
  private static legKey(key: string | null | undefined, leg: 'out' | 'in'): string | null {
    return key ? `${key}:${leg}` : null;
  }

  async transfer(uid: string, dto: TransferDto) {
    if (dto.idempotencyKey) {
      // A replay returns both legs, the same shape a fresh transfer returns.
      const existing = await this.txns.find({
        where: [
          { idempotencyKey: TransactionsService.legKey(dto.idempotencyKey, 'out')!, ownerId: uid },
          { idempotencyKey: TransactionsService.legKey(dto.idempotencyKey, 'in')!, ownerId: uid },
        ],
        order: { createdAt: 'ASC' },
      });
      if (existing.length) return existing;
    }
    const txAmount = parseFloat(dto.amount as unknown as string);
    if (!(txAmount > 0)) throw new BadRequestException('Amount must be greater than zero');
    return this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(Wallet);
      const tRepo = tx.getRepository(PaymentTransaction);
      const from = await wRepo.findOne({ where: { id: dto.fromWalletId } });
      const to = await wRepo.findOne({ where: { id: dto.toWalletId } });
      if (!from || !to) throw new NotFoundException('Wallet not found');
      if (from.ownerId !== uid) throw new ForbiddenException();
      // Cross-owner transfers are explicitly allowed (B2B / supplier payouts);
      // the source-wallet ownership check is the access-control gate.
      if (from.currency !== to.currency) throw new BadRequestException('Currency mismatch');

      // Atomic debit from source with funds check baked into WHERE so two
      // concurrent transfers can't both drain the same balance.
      const debit = await wRepo
        .createQueryBuilder()
        .update(Wallet)
        .set({ balance: () => 'balance - :txAmount' })
        .setParameter('txAmount', txAmount)
        .where('id = :id AND "ownerId" = :uid AND balance >= :amt', {
          id: from.id, uid, amt: txAmount,
        })
        .execute();
      if (debit.affected === 0) throw new BadRequestException('Insufficient funds');
      await wRepo
        .createQueryBuilder()
        .update(Wallet)
        .set({ balance: () => 'balance + :txAmount' })
        .setParameter('txAmount', txAmount)
        .where('id = :id', { id: to.id })
        .execute();

      const outgoing = tRepo.create({
        ownerId: uid, walletId: from.id, type: 'TRANSFER', amount: dto.amount,
        currency: from.currency, status: 'COMPLETED', counterparty: to.id,
        description: dto.description ?? 'Outgoing transfer',
        idempotencyKey: TransactionsService.legKey(dto.idempotencyKey, 'out'),
      });
      const incoming = tRepo.create({
        ownerId: to.ownerId, walletId: to.id, type: 'TRANSFER', amount: dto.amount,
        currency: to.currency, status: 'COMPLETED', counterparty: from.id,
        description: dto.description ?? 'Incoming transfer',
        idempotencyKey: TransactionsService.legKey(dto.idempotencyKey, 'in'),
      });
      return tRepo.save([outgoing, incoming]);
    });
  }
}

@Injectable()
export class LoansService extends OwnedCrudService<CreditLoan> {
  constructor(@InjectRepository(CreditLoan) repo: Repository<CreditLoan>) { super(repo); }

  async createLoan(uid: string, dto: CreateLoanDto) {
    return this.create(uid, { ...dto, outstanding: dto.principal, status: 'ACTIVE' });
  }

  async updateLoan(uid: string, id: string, dto: UpdateLoanDto) {
    return this.update(uid, id, dto);
  }
}
