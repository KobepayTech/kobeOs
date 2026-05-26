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

/**
 * Thin client for Beem Africa SMS (and a WhatsApp stub).
 *
 * Reads credentials from env at construction:
 *   BEEM_API_KEY, BEEM_SECRET_KEY   — required for sending
 *   BEEM_SOURCE_ADDR                — sender ID, defaults to 'KOBE'
 *   BEEM_SMS_URL                    — override endpoint (defaults to canonical /v1/send)
 *
 * When credentials are missing the service is a no-op (logs a warning),
 * so the rest of the app keeps working without Beem set up.
 */
@Injectable()
export class BeemService {
  private readonly logger = new Logger('BeemService');
  private readonly apiKey?: string;
  private readonly secretKey?: string;
  private readonly sourceAddr: string;
  private readonly smsUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('BEEM_API_KEY');
    this.secretKey = config.get<string>('BEEM_SECRET_KEY');
    this.sourceAddr = config.get<string>('BEEM_SOURCE_ADDR') ?? 'KOBE';
    this.smsUrl = config.get<string>('BEEM_SMS_URL') ?? 'https://apisms.beem.africa/v1/send';
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

  async sendSms(to: string, message: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.debug('Beem credentials not set; skipping SMS');
      return;
    }
    const dest = BeemService.normalizePhone(to);
    if (!dest) {
      this.logger.warn(`Invalid phone for SMS: '${to}'`);
      return;
    }
    const body: BeemSmsBody = {
      source_addr: this.sourceAddr,
      schedule_time: '',
      encoding: 0,
      message,
      recipients: [{ recipient_id: 1, dest_addr: dest }],
    };
    const basic = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    try {
      const res = await fetch(this.smsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basic}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`Beem SMS failed (${res.status}) to ${dest}: ${text}`);
      } else {
        this.logger.log(`Beem SMS sent to ${dest}`);
      }
    } catch (err) {
      this.logger.warn(`Beem SMS error to ${dest}: ${(err as Error).message}`);
    }
  }

  /**
   * WhatsApp via Beem requires onboarded sender + approved templates, which
   * are environment-specific. Kept as a stub until those credentials/templates
   * are configured; safe to call — logs only.
   */
  async sendWhatsApp(to: string, message: string): Promise<void> {
    this.logger.debug(`[whatsapp stub] to=${to} msg=${message.slice(0, 80)}`);
  }
}
