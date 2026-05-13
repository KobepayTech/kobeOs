import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreditLoan, PaymentTransaction, Wallet } from './payments.entity';
import { CreateLoanDto, CreateWalletDto, TransactionDto, TransferDto, UpdateLoanDto } from './dto/payments.dto';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class WalletsService {
  constructor(@InjectRepository(Wallet) private readonly repo: Repository<Wallet>) {}
  list(uid: string) { return this.repo.find({ where: { ownerId: uid } }); }
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

  list(uid: string) {
    return this.txns.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  byWallet(uid: string, walletId: string) {
    return this.txns.find({ where: { ownerId: uid, walletId }, order: { createdAt: 'DESC' } });
  }

  async post(uid: string, dto: TransactionDto) {
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
      }));
    });
  }

  async transfer(uid: string, dto: TransferDto) {
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
      });
      const incoming = tRepo.create({
        ownerId: to.ownerId, walletId: to.id, type: 'TRANSFER', amount: dto.amount,
        currency: to.currency, status: 'COMPLETED', counterparty: from.id,
        description: dto.description ?? 'Incoming transfer',
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
