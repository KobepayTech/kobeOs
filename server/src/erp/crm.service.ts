import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ErpCrmActivity, ErpCrmLead, ErpCrmStage } from './crm.entity';

const normalizePhone = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
};

@Injectable()
export class ErpCrmService {
  constructor(
    @InjectRepository(ErpCrmLead) private readonly leads: Repository<ErpCrmLead>,
    @InjectRepository(ErpCrmActivity) private readonly activities: Repository<ErpCrmActivity>,
  ) {}

  async upsertLead(ownerId: string, input: {
    businessId?: string | null;
    source?: ErpCrmLead['source'];
    sourceRefId?: string;
    customerName: string;
    customerPhone?: string;
    customerWhatsapp?: string;
    customerEmail?: string;
    subject: string;
    stage?: ErpCrmStage;
    value?: number;
    currency?: string;
    notes?: string;
    assignedTo?: string;
    nextActionAt?: Date | string | null;
    metadata?: Record<string, unknown>;
    activityBody?: string;
    activityType?: ErpCrmActivity['type'];
  }) {
    const phone = normalizePhone(input.customerPhone || input.customerWhatsapp || '');
    const subject = input.subject.trim();
    const activeStages: ErpCrmStage[] = ['NEW', 'CONTACTED', 'APPOINTMENT', 'NEGOTIATING', 'DEPOSIT'];
    const candidates = phone
      ? await this.leads.find({
          where: { ownerId, customerPhone: phone, stage: In(activeStages) },
          order: { updatedAt: 'DESC' },
          take: 20,
        })
      : [];

    let lead = candidates.find((row) =>
      row.businessId === (input.businessId ?? null) &&
      row.subject.trim().toLowerCase() === subject.toLowerCase(),
    );

    if (!lead && input.sourceRefId) {
      lead = await this.leads.findOne({
        where: {
          ownerId,
          source: input.source ?? 'MANUAL',
          sourceRefId: input.sourceRefId,
        },
        order: { updatedAt: 'DESC' },
      }) ?? undefined;
    }

    if (!lead) {
      lead = this.leads.create({
        ownerId,
        businessId: input.businessId ?? null,
        source: input.source ?? 'MANUAL',
        sourceRefId: input.sourceRefId ?? '',
        customerName: input.customerName.trim(),
        customerPhone: phone,
        customerWhatsapp: normalizePhone(input.customerWhatsapp || input.customerPhone || ''),
        customerEmail: input.customerEmail?.trim().toLowerCase() ?? '',
        subject,
        stage: input.stage ?? 'NEW',
        value: Number(input.value) || 0,
        currency: input.currency ?? 'TZS',
        assignedTo: input.assignedTo?.trim() ?? '',
        nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
        notes: input.notes?.trim() ?? '',
        metadata: input.metadata ?? {},
      });
    } else {
      lead.source = input.source ?? lead.source;
      if (input.sourceRefId) lead.sourceRefId = input.sourceRefId;
      lead.customerName = input.customerName.trim() || lead.customerName;
      lead.customerPhone = phone || lead.customerPhone;
      lead.customerWhatsapp = normalizePhone(input.customerWhatsapp || input.customerPhone || '') || lead.customerWhatsapp;
      lead.customerEmail = input.customerEmail?.trim().toLowerCase() || lead.customerEmail;
      lead.stage = input.stage ?? lead.stage;
      lead.value = input.value === undefined ? lead.value : Number(input.value) || 0;
      lead.currency = input.currency ?? lead.currency;
      lead.assignedTo = input.assignedTo === undefined ? lead.assignedTo : input.assignedTo.trim();
      lead.nextActionAt = input.nextActionAt === undefined ? lead.nextActionAt : (input.nextActionAt ? new Date(input.nextActionAt) : null);
      lead.notes = input.notes === undefined ? lead.notes : input.notes.trim();
      lead.metadata = { ...(lead.metadata ?? {}), ...(input.metadata ?? {}) };
    }

    lead = await this.leads.save(lead);
    if (input.activityBody) {
      await this.addActivity(ownerId, lead.id, {
        type: input.activityType ?? 'NOTE',
        body: input.activityBody,
        metadata: input.metadata,
      });
    }
    return lead;
  }

  async list(ownerId: string, query: { stage?: string; source?: string; businessId?: string; q?: string } = {}) {
    const qb = this.leads.createQueryBuilder('lead').where('lead.ownerId = :ownerId', { ownerId });
    if (query.stage) qb.andWhere('lead.stage = :stage', { stage: query.stage });
    if (query.source) qb.andWhere('lead.source = :source', { source: query.source });
    if (query.businessId) qb.andWhere('lead.businessId = :businessId', { businessId: query.businessId });
    if (query.q) {
      qb.andWhere('(LOWER(lead.customerName) LIKE :q OR lead.customerPhone LIKE :q OR LOWER(lead.subject) LIKE :q)', {
        q: `%${query.q.toLowerCase()}%`,
      });
    }
    return qb.orderBy('lead.updatedAt', 'DESC').take(300).getMany();
  }

  async summary(ownerId: string) {
    const leads = await this.leads.find({ where: { ownerId } });
    const stages: ErpCrmStage[] = ['NEW', 'CONTACTED', 'APPOINTMENT', 'NEGOTIATING', 'DEPOSIT', 'WON', 'LOST'];
    return {
      total: leads.length,
      open: leads.filter((lead) => !['WON', 'LOST'].includes(lead.stage)).length,
      pipelineValue: leads.filter((lead) => !['WON', 'LOST'].includes(lead.stage)).reduce((sum, lead) => sum + Number(lead.value || 0), 0),
      byStage: Object.fromEntries(stages.map((stage) => [stage, leads.filter((lead) => lead.stage === stage).length])),
    };
  }

  async updateLead(ownerId: string, id: string, patch: {
    stage?: ErpCrmStage;
    assignedTo?: string;
    nextActionAt?: string | Date | null;
    notes?: string;
    value?: number;
    currency?: string;
  }) {
    const lead = await this.leads.findOne({ where: { id, ownerId } });
    if (!lead) throw new NotFoundException('CRM lead not found');
    const previousStage = lead.stage;
    if (patch.stage) lead.stage = patch.stage;
    if (patch.assignedTo !== undefined) lead.assignedTo = patch.assignedTo.trim();
    if (patch.nextActionAt !== undefined) lead.nextActionAt = patch.nextActionAt ? new Date(patch.nextActionAt) : null;
    if (patch.notes !== undefined) lead.notes = patch.notes.trim();
    if (patch.value !== undefined) lead.value = Number(patch.value) || 0;
    if (patch.currency !== undefined) lead.currency = patch.currency;
    const saved = await this.leads.save(lead);
    if (patch.stage && patch.stage !== previousStage) {
      await this.addActivity(ownerId, id, {
        type: 'STATUS_CHANGE',
        body: `Stage changed from ${previousStage} to ${patch.stage}`,
      });
    }
    return saved;
  }

  async addActivity(ownerId: string, leadId: string, input: {
    type?: ErpCrmActivity['type'];
    body?: string;
    scheduledFor?: string | Date | null;
    completedAt?: string | Date | null;
    metadata?: Record<string, unknown>;
  }) {
    const lead = await this.leads.findOne({ where: { id: leadId, ownerId } });
    if (!lead) throw new NotFoundException('CRM lead not found');
    return this.activities.save(this.activities.create({
      ownerId,
      leadId,
      type: input.type ?? 'NOTE',
      body: input.body?.trim() ?? '',
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      metadata: input.metadata ?? {},
    }));
  }

  async listActivities(ownerId: string, leadId: string) {
    const lead = await this.leads.findOne({ where: { id: leadId, ownerId } });
    if (!lead) throw new NotFoundException('CRM lead not found');
    return this.activities.find({ where: { ownerId, leadId }, order: { createdAt: 'DESC' } });
  }
}
