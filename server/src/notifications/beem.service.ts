import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface BeemRecipient { recipient_id: number; dest_addr: string; }
interface BeemSmsBody {
  source_addr: string;
  schedule_time: string;
  encoding: number;
  message: string;
  recipients: BeemRecipient[];
}

export interface BeemSendResult {
  ok: boolean;
  /** Per-recipient request id returned by Beem (when available). Used
   *  as the externalId on OutboundMessage for later delivery-webhook
   *  correlation. */
  externalId?: string;
  error?: string;
}

/**
 * Thin client for Beem Africa SMS and WhatsApp Business API.
 *
 * Reads credentials from env at construction:
 *   BEEM_API_KEY, BEEM_SECRET_KEY   — required for sending
 *   BEEM_SOURCE_ADDR                — SMS sender ID, defaults to 'KOBE'
 *   BEEM_SMS_URL                    — override SMS endpoint
 *   BEEM_WHATSAPP_URL               — override WhatsApp endpoint
 *
 * When credentials are missing the service is a no-op (logs a warning),
 * so the rest of the app keeps working without Beem set up.
 *
 * WhatsApp note: sending via Beem's WhatsApp Business API requires a
 * Meta-approved template per use case. You pass the template name +
 * language + any variable substitutions on each call. Beem returns
 * 400 if the template isn't approved for your sender — see the audit
 * log on OutboundMessage.error for the exact reason.
 */
@Injectable()
export class BeemService {
  private readonly logger = new Logger('BeemService');
  private readonly apiKey?: string;
  private readonly secretKey?: string;
  private readonly sourceAddr: string;
  private readonly smsUrl: string;
  private readonly whatsappUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('BEEM_API_KEY');
    this.secretKey = config.get<string>('BEEM_SECRET_KEY');
    this.sourceAddr = config.get<string>('BEEM_SOURCE_ADDR') ?? 'KOBE';
    this.smsUrl = config.get<string>('BEEM_SMS_URL') ?? 'https://apisms.beem.africa/v1/send';
    this.whatsappUrl = config.get<string>('BEEM_WHATSAPP_URL') ?? 'https://apiwhatsapp.beem.africa/v1/send';
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.secretKey);
  }

  /** Normalize TZ-style numbers (+255…, 0712…) to MSISDN digits Beem expects. */
  static normalizePhone(raw: string): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('255')) return digits;
    if (digits.startsWith('0')) return `255${digits.slice(1)}`;
    return digits;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64')}`;
  }

  async sendSms(to: string, message: string): Promise<BeemSendResult> {
    if (!this.isConfigured()) {
      this.logger.debug('Beem credentials not set; skipping SMS');
      return { ok: false, error: 'Beem credentials not configured' };
    }
    const dest = BeemService.normalizePhone(to);
    if (!dest) {
      return { ok: false, error: `Invalid phone '${to}'` };
    }
    return this.sendSmsBatch([{ phone: dest }], message);
  }

  /** Bulk SMS — single Beem call for up to a few hundred recipients.
   *  Returns one result per input recipient, matching the order. */
  async sendSmsBatch(
    targets: Array<{ phone: string }>,
    message: string,
  ): Promise<BeemSendResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Beem credentials not configured' };
    }
    const recipients: BeemRecipient[] = targets
      .map((t, i) => {
        const dest = BeemService.normalizePhone(t.phone);
        return dest ? { recipient_id: i + 1, dest_addr: dest } : null;
      })
      .filter((r): r is BeemRecipient => r !== null);
    if (recipients.length === 0) return { ok: false, error: 'No valid recipients' };
    const body: BeemSmsBody = {
      source_addr: this.sourceAddr,
      schedule_time: '',
      encoding: 0,
      message,
      recipients,
    };
    try {
      const res = await fetch(this.smsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`Beem SMS failed (${res.status}): ${text}`);
        return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = await res.json().catch(() => ({})) as { request_id?: string | number };
      const externalId = data.request_id != null ? String(data.request_id) : undefined;
      this.logger.log(`Beem SMS sent to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'} (request ${externalId ?? 'unknown'})`);
      return { ok: true, externalId };
    } catch (err) {
      const error = (err as Error).message;
      this.logger.warn(`Beem SMS network error: ${error}`);
      return { ok: false, error };
    }
  }

  /**
   * Send a WhatsApp template message (one recipient per call — Beem's
   * WhatsApp API doesn't accept arrays). Template name + language must
   * match a Meta-approved template under your sender.
   *
   *   variables  — ordered list of {{1}}, {{2}}, … substitutions
   *                inside the template body. Pass empty array for
   *                static templates.
   */
  async sendWhatsAppTemplate(
    to: string,
    templateName: string,
    language: string,
    variables: string[] = [],
  ): Promise<BeemSendResult> {
    if (!this.isConfigured()) {
      this.logger.debug('Beem credentials not set; skipping WhatsApp');
      return { ok: false, error: 'Beem credentials not configured' };
    }
    const dest = BeemService.normalizePhone(to);
    if (!dest) return { ok: false, error: `Invalid phone '${to}'` };

    const body = {
      recipient_id: `${dest}-${Date.now()}`,
      msisdn: dest,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language || 'en' },
        components: variables.length === 0 ? [] : [
          {
            type: 'body',
            parameters: variables.map((v) => ({ type: 'text', text: String(v) })),
          },
        ],
      },
    };
    try {
      const res = await fetch(this.whatsappUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`Beem WhatsApp failed (${res.status}) to ${dest}: ${text}`);
        return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = await res.json().catch(() => ({})) as { request_id?: string | number };
      const externalId = data.request_id != null ? String(data.request_id) : undefined;
      return { ok: true, externalId };
    } catch (err) {
      const error = (err as Error).message;
      this.logger.warn(`Beem WhatsApp network error to ${dest}: ${error}`);
      return { ok: false, error };
    }
  }

  /** Legacy alias kept so existing cargo-notification call sites keep
   *  compiling. Sends a free-text WhatsApp via template fallback —
   *  callers that actually need template variables should use
   *  sendWhatsAppTemplate() directly. */
  async sendWhatsApp(to: string, message: string): Promise<BeemSendResult> {
    const template = process.env.BEEM_WHATSAPP_DEFAULT_TEMPLATE;
    if (!template) {
      this.logger.debug(`No BEEM_WHATSAPP_DEFAULT_TEMPLATE configured; skipping WhatsApp to ${to}`);
      return { ok: false, error: 'No default WhatsApp template configured' };
    }
    return this.sendWhatsAppTemplate(to, template, 'en', [message]);
  }
}
