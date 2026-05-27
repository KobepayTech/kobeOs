import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate, ExchangeRateStatus } from './exchange-rate.entity';

export interface CreateExchangeRateDto {
  txnReference: string;
  txnDate: string;
  currency: string;
  amountUsd: number;
  customerRate: number;
  notes?: string;
}

export interface FundExchangeRateDto {
  actualRate: number;
  fundedDate: string;
  notes?: string;
}

export interface ProfitLossSummary {
  currency: string;
  totalVolumeUsd: number;
  totalProfitLoss: number;
  profitableCount: number;
  lossCount: number;
  pendingCount: number;
  entries: ExchangeRate[];
}

@Injectable()
export class ExchangeRateService {
  constructor(
    @InjectRepository(ExchangeRate)
    private readonly repo: Repository<ExchangeRate>,
  ) {}

  async create(uid: string, dto: CreateExchangeRateDto): Promise<ExchangeRate> {
    const customerReceives = dto.amountUsd * dto.customerRate;
    const entry = this.repo.create({
      recordedBy: uid,
      txnReference: dto.txnReference,
      txnDate: dto.txnDate,
      currency: dto.currency,
      amountUsd: dto.amountUsd,
      customerRate: dto.customerRate,
      customerReceives,
      actualRate: 0,
      actualPaid: 0,
      profitLoss: 0,
      status: 'pending',
      notes: dto.notes ?? '',
    });
    return this.repo.save(entry);
  }

  /**
   * Record the actual payout-day rate and compute profit/loss.
   * Only callable once per entry (status must be 'pending').
   */
  async fund(uid: string, id: string, dto: FundExchangeRateDto): Promise<ExchangeRate> {
    const entry = await this.repo.findOne({ where: { id, recordedBy: uid } });
    if (!entry) throw new NotFoundException('Exchange rate entry not found');

    const actualPaid = Number(entry.amountUsd) * dto.actualRate;
    const profitLoss = actualPaid - Number(entry.customerReceives);

    entry.actualRate = dto.actualRate;
    entry.actualPaid = actualPaid;
    entry.profitLoss = profitLoss;
    entry.fundedDate = dto.fundedDate;
    entry.status = 'funded';
    if (dto.notes) entry.notes = dto.notes;

    return this.repo.save(entry);
  }

  async list(uid: string, currency?: string): Promise<ExchangeRate[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.recordedBy = :uid', { uid })
      .orderBy('e.txnDate', 'DESC');
    if (currency) qb.andWhere('e.currency = :currency', { currency });
    return qb.getMany();
  }

  async summary(uid: string, currency?: string): Promise<ProfitLossSummary[]> {
    const entries = await this.list(uid, currency);
    const byCurrency = new Map<string, ExchangeRate[]>();
    for (const e of entries) {
      const arr = byCurrency.get(e.currency) ?? [];
      arr.push(e);
      byCurrency.set(e.currency, arr);
    }

    return Array.from(byCurrency.entries()).map(([cur, rows]) => {
      const funded = rows.filter(r => r.status === 'funded');
      return {
        currency: cur,
        totalVolumeUsd: funded.reduce((s, r) => s + Number(r.amountUsd), 0),
        totalProfitLoss: funded.reduce((s, r) => s + Number(r.profitLoss), 0),
        profitableCount: funded.filter(r => Number(r.profitLoss) > 0).length,
        lossCount: funded.filter(r => Number(r.profitLoss) < 0).length,
        pendingCount: rows.filter(r => r.status === 'pending').length,
        entries: rows,
      };
    });
  }

  async cancel(uid: string, id: string): Promise<ExchangeRate> {
    const entry = await this.repo.findOne({ where: { id, recordedBy: uid } });
    if (!entry) throw new NotFoundException('Exchange rate entry not found');
    entry.status = 'cancelled' as ExchangeRateStatus;
    return this.repo.save(entry);
  }
}
