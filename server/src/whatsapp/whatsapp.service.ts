import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { BeemService } from '../notifications/beem.service';
import { KobeAgentService } from '../ai/agent.service';
import { GuardrailService } from '../ai/guardrail.service';
import { InboundMessage, isOptOut, parseInbound } from './whatsapp.parser';
import { WhatsAppContact, WhatsAppMessage, WhatsAppSettings } from './whatsapp.entity';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectRepository(WhatsAppContact) private readonly contacts: Repository<WhatsAppContact>,
    @InjectRepository(WhatsAppMessage) private readonly messages: Repository<WhatsAppMessage>,
    @InjectRepository(WhatsAppSettings) private readonly settings: Repository<WhatsAppSettings>,
    private readonly beem: BeemService,
    private readonly agent: KobeAgentService,
    private readonly guardrails: GuardrailService,
  ) {}

  /** Settings for a shop, creating the webhook token on first read. */
  async getSettings(ownerId: string): Promise<WhatsAppSettings> {
    const existing = await this.settings.findOne({ where: { ownerId } });
    if (existing) return existing;
    return this.settings.save(this.settings.create({
      ownerId,
      webhookToken: randomBytes(24).toString('base64url'),
      autoReply: false,
    }));
  }

  async setAutoReply(ownerId: string, autoReply: boolean): Promise<WhatsAppSettings> {
    const config = await this.getSettings(ownerId);
    config.autoReply = autoReply;
    return this.settings.save(config);
  }

  /** Issue a fresh token, invalidating the old webhook URL. */
  async rotateToken(ownerId: string): Promise<WhatsAppSettings> {
    const config = await this.getSettings(ownerId);
    config.webhookToken = randomBytes(24).toString('base64url');
    return this.settings.save(config);
  }

  /**
   * Handle a provider callback. Always resolves: a webhook that returns an
   * error gets retried, and a retry storm on a parsing bug would be worse
   * than dropping one message.
   */
  async receive(token: string, payload: unknown): Promise<{ accepted: number }> {
    const config = await this.settings.findOne({ where: { webhookToken: token } });
    if (!config) throw new NotFoundException('Unknown webhook');

    const inbound = parseInbound(payload);
    let accepted = 0;
    for (const message of inbound) {
      try {
        await this.ingest(config, message);
        accepted += 1;
      } catch (cause) {
        this.logger.warn(`Could not ingest WhatsApp message: ${(cause as Error)?.message}`);
      }
    }
    return { accepted };
  }

  private async ingest(config: WhatsAppSettings, inbound: InboundMessage): Promise<void> {
    const ownerId = config.ownerId;

    // Providers redeliver. Without this an auto-reply could be sent twice for
    // one customer message.
    if (inbound.externalId) {
      const seen = await this.messages.findOne({ where: { ownerId, externalId: inbound.externalId } });
      if (seen) return;
    }

    const contact = await this.contactFor(ownerId, inbound);
    await this.messages.save(this.messages.create({
      ownerId, contactId: contact.id, direction: 'in',
      body: inbound.body, externalId: inbound.externalId,
    }));
    contact.lastMessageAt = new Date();

    if (isOptOut(inbound.body)) {
      contact.optedOut = true;
      await this.contacts.save(contact);
      return;
    }
    await this.contacts.save(contact);

    if (!config.autoReply || contact.optedOut) return;
    await this.autoReply(ownerId, contact, inbound.body);
  }

  /**
   * Answer a customer with the shop's assistant.
   *
   * Everything here is best-effort and failure-silent: a customer message must
   * always be stored even if the reply cannot be produced or sent, otherwise
   * the shop loses the enquiry as well as the answer.
   */
  private async autoReply(ownerId: string, contact: WhatsAppContact, question: string): Promise<void> {
    const record = async (body: string, note = '') => {
      await this.messages.save(this.messages.create({
        ownerId, contactId: contact.id, direction: 'out', body, note,
      }));
    };

    try {
      // The same guardrails that protect the in-app assistant apply here, and
      // matter more: this reply goes to a customer in the shop's name.
      await this.guardrails.assertInputAllowed(ownerId, question);
    } catch (cause) {
      await record('', `Guardrail blocked the request: ${(cause as Error)?.message}`);
      return;
    }

    let reply = '';
    try {
      const result = await this.agent.run(ownerId, question, [], 'fast', undefined, undefined, {
        role: 'user', module: 'whatsapp',
      });
      reply = result.reply ?? '';
    } catch (cause) {
      this.logger.warn(`WhatsApp auto-reply failed: ${(cause as Error)?.message}`);
      return;
    }
    if (!reply) return;

    const review = await this.guardrails.reviewOutput(ownerId, reply);
    if (!review.allowed) {
      await record('', `Guardrail withheld the reply: ${review.reason ?? 'blocked'}`);
      return;
    }

    const sent = await this.beem.sendWhatsApp(contact.phone, reply);
    await record(reply, sent.ok ? '' : `Send failed: ${sent.error ?? 'unknown error'}`);
  }

  private async contactFor(ownerId: string, inbound: InboundMessage): Promise<WhatsAppContact> {
    const existing = await this.contacts.findOne({ where: { ownerId, phone: inbound.from } });
    if (existing) {
      if (inbound.name && !existing.displayName) existing.displayName = inbound.name;
      return existing;
    }
    return this.contacts.save(this.contacts.create({
      ownerId, phone: inbound.from, displayName: inbound.name || '',
    }));
  }

  listContacts(ownerId: string): Promise<WhatsAppContact[]> {
    return this.contacts.find({
      where: { ownerId },
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
      take: 200,
    });
  }

  async conversation(ownerId: string, contactId: string): Promise<{ contact: WhatsAppContact; messages: WhatsAppMessage[] }> {
    const contact = await this.contacts.findOne({ where: { id: contactId, ownerId } });
    if (!contact) throw new NotFoundException('Contact not found');
    const messages = await this.messages.find({
      where: { ownerId, contactId },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    return { contact, messages };
  }

  /** Reply by hand, which is the path that works with auto-reply switched off. */
  async sendManual(ownerId: string, contactId: string, body: string): Promise<WhatsAppMessage> {
    const { contact } = await this.conversation(ownerId, contactId);
    const sent = await this.beem.sendWhatsApp(contact.phone, body);
    return this.messages.save(this.messages.create({
      ownerId, contactId, direction: 'out', body,
      note: sent.ok ? '' : `Send failed: ${sent.error ?? 'unknown error'}`,
    }));
  }
}
