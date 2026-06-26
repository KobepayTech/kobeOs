import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ErpSummaryEntry } from './erp-summary-entry.entity';

type Kind = 'expenses' | 'sales';

export interface SummaryEntryInput {
  kind: Kind;
  date: string;            // YYYY-MM-DD
  amount: number;
  reason?: string;
}

export interface SummaryEntryBulkInput {
  entries: Array<SummaryEntryInput & { clientId?: string }>;
}

@Injectable()
export class ErpSummaryEntryService {
  constructor(
    @InjectRepository(ErpSummaryEntry) private readonly repo: Repository<ErpSummaryEntry>,
  ) {}

  list(ownerId: string) {
    return this.repo.find({
      where: { ownerId },
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(ownerId: string, dto: SummaryEntryInput): Promise<ErpSummaryEntry> {
    if (dto.kind !== 'expenses' && dto.kind !== 'sales') throw new BadRequestException('kind');
    if (!dto.date || !/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) throw new BadRequestException('date');
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('amount');
    return this.repo.save(this.repo.create({
      ownerId,
      kind: dto.kind,
      date: dto.date,
      amount,
      reason: (dto.reason ?? '').trim(),
    }));
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const found = await this.repo.findOne({ where: { id, ownerId } });
    if (!found) throw new NotFoundException();
    await this.repo.delete(found.id);
  }

  /** Push a batch from localStorage on first sync. Best-effort:
   *  invalid rows are silently dropped so a couple of bad legacy
   *  entries don't block the whole migration. */
  async bulkImport(ownerId: string, dto: SummaryEntryBulkInput): Promise<ErpSummaryEntry[]> {
    const rows: ErpSummaryEntry[] = [];
    for (const e of dto.entries ?? []) {
      if (e.kind !== 'expenses' && e.kind !== 'sales') continue;
      if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
      const amount = Number(e.amount);
      if (!Number.isFinite(amount) || amount < 0) continue;
      rows.push(this.repo.create({
        ownerId,
        kind: e.kind,
        date: e.date,
        amount,
        reason: (e.reason ?? '').trim(),
      }));
    }
    return rows.length ? this.repo.save(rows) : [];
  }
}
