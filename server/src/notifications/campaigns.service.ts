import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OutboundCampaign, OutboundMessage } from './outbound.entity';
import { BeemService } from './beem.service';
import { PosOrder } from '../pos/pos.entity';

export interface RecipientInput {
  phone: string;
  customerName?: string | null;
  /** Per-recipient template variable substitutions for WhatsApp. The
   *  array maps to {{1}}, {{2}}, … in the approved template body. For
   *  SMS this is ignored — the same `body` goes to everyone. */
  variables?: string[];
}

export interface CreateCampaignInput {
  channel: 'sms' | 'whatsapp';
  /** SMS body, OR for WhatsApp the human-readable preview (the actual
   *  message sent is the approved template with the per-recipient
   *  variables substituted). */
  body: string;
  templateName?: string;
  templateLanguage?: string;
  recipients: RecipientInput[];
}

export interface CustomerSummary {
  phone: string;
  name?: string | null;
  lastOrderAt?: string;
  orderCount: number;
  totalSpent: number;
}

/**
 * Bulk outbound messaging (SMS + WhatsApp template). Persists every
 * send as a campaign + per-recipient row so the operator can browse
 * history, retry failures, and see exactly what each customer received.
 *
 * The actual Beem HTTP calls happen async — POST returns the campaign
 * immediately with status=SENDING; the UI polls /campaigns/:id for
 * progress. SMS uses a single batched call; WhatsApp loops per
 * recipient because Beem's WhatsApp endpoint doesn't accept arrays.
 */
@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(OutboundCampaign) private readonly campaigns: Repository<OutboundCampaign>,
    @InjectRepository(OutboundMessage)  private readonly messages: Repository<OutboundMessage>,
    @InjectRepository(PosOrder)         private readonly orders: Repository<PosOrder>,
    private readonly beem: BeemService,
  ) {}

  async list(uid: string) {
    return this.campaigns.find({
      where: { ownerId: uid },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async get(uid: string, id: string) {
    const campaign = await this.campaigns.findOne({ where: { id, ownerId: uid } });
    if (!campaign) throw new NotFoundException();
    const items = await this.messages.find({
      where: { campaignId: id, ownerId: uid },
      order: { createdAt: 'ASC' },
    });
    return { ...campaign, messages: items };
  }

  /** Distinct customers who have ever placed an order with this owner.
   *  Powers the recipient-picker UI: "everyone who's bought from me". */
  async customers(uid: string): Promise<CustomerSummary[]> {
    const orders = await this.orders.find({
      where: { ownerId: uid },
      order: { createdAt: 'DESC' },
      take: 5000,
    });
    const byPhone = new Map<string, CustomerSummary>();
    for (const o of orders) {
      if (!o.customerPhone) continue;
      const phone = BeemService.normalizePhone(o.customerPhone);
      if (!phone) continue;
      const existing = byPhone.get(phone);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += Number(o.total);
      } else {
        byPhone.set(phone, {
          phone,
          name: o.customerName ?? null,
          lastOrderAt: o.createdAt?.toISOString?.() ?? new Date().toISOString(),
          orderCount: 1,
          totalSpent: Number(o.total),
        });
      }
    }
    return Array.from(byPhone.values()).sort((a, b) => b.orderCount - a.orderCount);
  }

  async create(uid: string, dto: CreateCampaignInput): Promise<OutboundCampaign> {
    if (!dto.body?.trim()) throw new BadRequestException('Message body is required');
    if (dto.channel === 'whatsapp' && !dto.templateName?.trim()) {
      throw new BadRequestException('WhatsApp campaigns require a Meta-approved templateName');
    }
    const valid = (dto.recipients ?? []).filter((r) => BeemService.normalizePhone(r.phone));
    if (valid.length === 0) throw new BadRequestException('No valid recipient phones');

    const campaign = await this.campaigns.save(this.campaigns.create({
      ownerId: uid,
      channel: dto.channel,
      body: dto.body,
      templateName: dto.templateName ?? null,
      templateLanguage: dto.templateLanguage ?? (dto.channel === 'whatsapp' ? 'en' : null),
      recipientCount: valid.length,
      status: 'PENDING',
    }));

    const rows = valid.map((r) => this.messages.create({
      ownerId: uid,
      campaignId: campaign.id,
      phone: BeemService.normalizePhone(r.phone)!,
      customerName: r.customerName ?? null,
      body: this.renderBody(dto.body, r.variables),
      status: 'PENDING',
    }));
    await this.messages.save(rows);

    // Fire-and-forget — the API returns immediately so the operator's
    // browser doesn't wait through hundreds of Beem HTTP calls.
    void this.runCampaign(uid, campaign.id, dto);
    return campaign;
  }

  /** Substitutes {{1}}, {{2}}, … in `template` with the recipient's
   *  variables for the audit log. Beem's template API does the real
   *  substitution server-side; this is just so the OutboundMessage.body
   *  field accurately shows what the customer received. */
  private renderBody(template: string, variables?: string[]): string {
    if (!variables?.length) return template;
    return template.replace(/\{\{(\d+)\}\}/g, (m, idx) => {
      const i = Number(idx) - 1;
      return i >= 0 && i < variables.length ? String(variables[i]) : m;
    });
  }

  private async runCampaign(uid: string, campaignId: string, dto: CreateCampaignInput) {
    const campaign = await this.campaigns.findOne({ where: { id: campaignId, ownerId: uid } });
    if (!campaign) return;
    campaign.status = 'SENDING';
    campaign.startedAt = new Date();
    await this.campaigns.save(campaign);

    const pending = await this.messages.find({
      where: { campaignId, ownerId: uid, status: 'PENDING' },
    });

    let sent = 0;
    let failed = 0;

    if (dto.channel === 'sms') {
      // Single batched call — Beem accepts the full recipient list at once.
      const result = await this.beem.sendSmsBatch(
        pending.map((r) => ({ phone: r.phone })),
        dto.body,
      );
      const now = new Date();
      if (result.ok) {
        for (const m of pending) {
          m.status = 'SENT';
          m.externalId = result.externalId ?? null;
          m.sentAt = now;
        }
        sent = pending.length;
      } else {
        for (const m of pending) {
          m.status = 'FAILED';
          m.error = result.error ?? 'Unknown Beem error';
        }
        failed = pending.length;
      }
      await this.messages.save(pending);
    } else {
      // WhatsApp: one HTTP call per recipient (Beem's template endpoint
      // doesn't accept arrays). Recipients map back to OutboundMessage
      // by phone, in order — same order as dto.recipients.
      const variablesByPhone = new Map<string, string[] | undefined>();
      for (const r of dto.recipients) {
        const phone = BeemService.normalizePhone(r.phone);
        if (phone) variablesByPhone.set(phone, r.variables);
      }
      const concurrency = 4;
      for (let i = 0; i < pending.length; i += concurrency) {
        const batch = pending.slice(i, i + concurrency);
        await Promise.all(batch.map(async (m) => {
          const vars = variablesByPhone.get(m.phone) ?? [];
          const result = await this.beem.sendWhatsAppTemplate(
            m.phone,
            dto.templateName!,
            dto.templateLanguage || 'en',
            vars,
          );
          if (result.ok) {
            m.status = 'SENT';
            m.externalId = result.externalId ?? null;
            m.sentAt = new Date();
            sent += 1;
          } else {
            m.status = 'FAILED';
            m.error = result.error ?? 'Unknown Beem error';
            failed += 1;
          }
        }));
        await this.messages.save(batch);
        // Update progress incrementally so the UI poll shows movement.
        campaign.sentCount = sent;
        campaign.failedCount = failed;
        await this.campaigns.save(campaign);
      }
    }

    campaign.sentCount = sent;
    campaign.failedCount = failed;
    campaign.status = failed === 0 ? 'COMPLETED' : (sent === 0 ? 'FAILED' : 'COMPLETED');
    campaign.finishedAt = new Date();
    await this.campaigns.save(campaign);
    this.logger.log(`Campaign ${campaignId} done — ${sent} sent, ${failed} failed`);
  }

  /** Retry just the failed rows of a previous campaign. Useful when
   *  Beem credit ran out mid-send or a few phones were temporarily
   *  unreachable. Returns a freshly-created campaign that batches the
   *  failures. */
  async retryFailures(uid: string, campaignId: string): Promise<OutboundCampaign> {
    const source = await this.campaigns.findOne({ where: { id: campaignId, ownerId: uid } });
    if (!source) throw new NotFoundException();
    const failed = await this.messages.find({
      where: { campaignId, ownerId: uid, status: In(['FAILED']) },
    });
    if (failed.length === 0) throw new BadRequestException('No failed messages to retry');
    return this.create(uid, {
      channel: source.channel,
      body: source.body,
      templateName: source.templateName ?? undefined,
      templateLanguage: source.templateLanguage ?? undefined,
      recipients: failed.map((m) => ({ phone: m.phone, customerName: m.customerName })),
    });
  }
}
