import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrintJob, PrintMaterial, PrintTemplate } from './print.entity';
import {
  AdjustStockDto,
  CreatePrintJobDto, CreatePrintMaterialDto, CreatePrintTemplateDto,
  UpdatePrintJobDto, UpdatePrintMaterialDto, UpdatePrintTemplateDto,
} from './dto/print.dto';

// ── Jobs ──────────────────────────────────────────────────────────────────────

@Injectable()
export class PrintJobsService {
  constructor(@InjectRepository(PrintJob) private readonly repo: Repository<PrintJob>) {}

  list(uid: string, page = 1, limit = 50, status?: string) {
    const where: Record<string, unknown> = { ownerId: uid };
    if (status) where.status = status;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
  }

  async get(uid: string, id: string) {
    const job = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!job) throw new NotFoundException();
    return job;
  }

  create(uid: string, dto: CreatePrintJobDto) {
    return this.repo.save(this.repo.create({ ...dto, ownerId: uid, status: 'Pending', priority: dto.priority ?? 'Medium', qty: dto.qty ?? 1 }));
  }

  async update(uid: string, id: string, dto: UpdatePrintJobDto) {
    const job = await this.get(uid, id);
    Object.assign(job, dto);
    return this.repo.save(job);
  }

  async remove(uid: string, id: string) {
    const job = await this.get(uid, id);
    await this.repo.remove(job);
    return { id };
  }

  async stats(uid: string) {
    const jobs = await this.repo.find({ where: { ownerId: uid } });
    return {
      total:      jobs.length,
      pending:    jobs.filter(j => j.status === 'Pending').length,
      printing:   jobs.filter(j => j.status === 'Printing').length,
      finishing:  jobs.filter(j => j.status === 'Finishing').length,
      completed:  jobs.filter(j => j.status === 'Completed').length,
      revenue:    jobs.filter(j => j.status === 'Completed').reduce((s, j) => s + Number(j.price) * j.qty, 0),
    };
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

@Injectable()
export class PrintTemplatesService {
  constructor(@InjectRepository(PrintTemplate) private readonly repo: Repository<PrintTemplate>) {}

  list(uid: string) {
    return this.repo.find({ where: { ownerId: uid, active: true }, order: { name: 'ASC' } });
  }

  async get(uid: string, id: string) {
    const t = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!t) throw new NotFoundException();
    return t;
  }

  create(uid: string, dto: CreatePrintTemplateDto) {
    return this.repo.save(this.repo.create({ ...dto, ownerId: uid, active: dto.active ?? true, canvasData: dto.canvasData ?? '[]' }));
  }

  async update(uid: string, id: string, dto: UpdatePrintTemplateDto) {
    const t = await this.get(uid, id);
    Object.assign(t, dto);
    return this.repo.save(t);
  }

  async remove(uid: string, id: string) {
    const t = await this.get(uid, id);
    await this.repo.remove(t);
    return { id };
  }
}

// ── Materials ─────────────────────────────────────────────────────────────────

@Injectable()
export class PrintMaterialsService {
  constructor(@InjectRepository(PrintMaterial) private readonly repo: Repository<PrintMaterial>) {}

  async list(uid: string) {
    const items = await this.repo.find({ where: { ownerId: uid }, order: { name: 'ASC' } });
    return items.map(m => ({
      ...m,
      status: Number(m.stock) === 0 ? 'Out' : Number(m.stock) <= Number(m.minThreshold) ? 'Low' : 'In Stock',
    }));
  }

  async get(uid: string, id: string) {
    const m = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!m) throw new NotFoundException();
    return m;
  }

  create(uid: string, dto: CreatePrintMaterialDto) {
    return this.repo.save(this.repo.create({ ...dto, ownerId: uid, stock: dto.stock ?? 0, minThreshold: dto.minThreshold ?? 0 }));
  }

  async update(uid: string, id: string, dto: UpdatePrintMaterialDto) {
    const m = await this.get(uid, id);
    Object.assign(m, dto);
    return this.repo.save(m);
  }

  async adjustStock(uid: string, id: string, dto: AdjustStockDto) {
    const m = await this.get(uid, id);
    m.stock = Math.max(0, Number(m.stock) + dto.delta) as unknown as number;
    return this.repo.save(m);
  }

  async remove(uid: string, id: string) {
    const m = await this.get(uid, id);
    await this.repo.remove(m);
    return { id };
  }
}
