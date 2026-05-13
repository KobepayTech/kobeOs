import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreditLoan, PaymentTransaction, Wallet } from './payments.entity';
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
    private readonly ds: DataSource,
  ) {}

  list(uid: string, page = 1, limit = 50) {
    return this.txns.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
  }

  byWallet(uid: string, walletId: string, page = 1, limit = 50) {
    return this.txns.find({ where: { ownerId: uid, walletId }, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
  }

  async post(uid: string, dto: TransactionDto) {
    if (dto.idempotencyKey) {
      const existing = await this.txns.findOne({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) return existing;
    }
    return this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(Wallet);
      const tRepo = tx.getRepository(PaymentTransaction);
      const wallet = await wRepo.findOne({ where: { id: dto.walletId, ownerId: uid } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      if (dto.type === 'DEBIT' && wallet.balance < dto.amount) {
        throw new BadRequestException('Insufficient funds');
      }
      wallet.balance += dto.type === 'CREDIT' ? dto.amount : -dto.amount;
      await wRepo.save(wallet);
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

  async transfer(uid: string, dto: TransferDto) {
    if (dto.idempotencyKey) {
      const existing = await this.txns.findOne({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) return existing;
    }
    return this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(Wallet);
      const tRepo = tx.getRepository(PaymentTransaction);
      const from = await wRepo.findOne({ where: { id: dto.fromWalletId } });
      const to = await wRepo.findOne({ where: { id: dto.toWalletId } });
      if (!from || !to) throw new NotFoundException('Wallet not found');
      if (from.ownerId !== uid) throw new ForbiddenException();
      if (from.balance < dto.amount) throw new BadRequestException('Insufficient funds');
      if (from.currency !== to.currency) throw new BadRequestException('Currency mismatch');

      from.balance -= dto.amount;
      to.balance += dto.amount;
      await wRepo.save([from, to]);

      const outgoing = tRepo.create({
        ownerId: uid, walletId: from.id, type: 'TRANSFER', amount: dto.amount,
        currency: from.currency, status: 'COMPLETED', counterparty: to.id,
        description: dto.description ?? 'Outgoing transfer',
        idempotencyKey: dto.idempotencyKey ?? null,
      });
      const incoming = tRepo.create({
        ownerId: to.ownerId, walletId: to.id, type: 'TRANSFER', amount: dto.amount,
        currency: to.currency, status: 'COMPLETED', counterparty: from.id,
        description: dto.description ?? 'Incoming transfer',
        idempotencyKey: dto.idempotencyKey ?? null,
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
