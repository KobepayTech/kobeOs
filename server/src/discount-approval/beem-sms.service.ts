import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Beem Africa SMS gateway.
 * Used to notify the owner when a discount request arrives and they are offline.
 *
 * Required env vars:
 *   BEEM_API_KEY     — Beem Africa API key
 *   BEEM_SECRET_KEY  — Beem Africa secret key
 *   BEEM_SENDER_ID   — Registered sender ID (e.g. "KobeERP")
 *
 * Docs: https://developers.beem.africa/
 */
@Injectable()
export class BeemSmsService {
  private readonly logger = new Logger(BeemSmsService.name);
  private readonly baseUrl = 'https://apisms.beem.africa/v1/send';

  constructor(private readonly config: ConfigService) {}

  private get apiKey():    string { return this.config.get('BEEM_API_KEY', ''); }
  private get secretKey(): string { return this.config.get('BEEM_SECRET_KEY', ''); }
  private get senderId():  string { return this.config.get('BEEM_SENDER_ID', 'KobeERP'); }

  private get configured(): boolean {
    return Boolean(this.apiKey && this.secretKey);
  }

  /**
   * Send an SMS to a single recipient.
   * Silently skips if Beem credentials are not configured.
   *
   * @param to   E.164 phone number, e.g. "+255712345678"
   * @param body Message text (max 160 chars for single SMS)
   */
  async send(to: string, body: string): Promise<void> {
    if (!this.configured) {
      this.logger.debug(`Beem SMS not configured — skipping SMS to ${to}`);
      return;
    }

    const payload = {
      source_addr: this.senderId,
      schedule_time: '',
      encoding: '0',
      message: body.slice(0, 160),
      recipients: [{ recipient_id: 1, dest_addr: to }],
    };

    try {
      const credentials = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`Beem SMS failed (${res.status}): ${text}`);
      } else {
        this.logger.log(`SMS sent to ${to}`);
      }
    } catch (e) {
      this.logger.warn(`Beem SMS error: ${(e as Error).message}`);
    }
  }

  /**
   * Send a discount request notification to the owner.
   * Only sends SMS — push notifications are handled by the main NotificationsService.
   */
  async notifyOwnerNewRequest(
    ownerPhone: string,
    sellerName: string,
    productName: string,
    discountPercent: number,
  ): Promise<void> {
    const msg =
      `KobeERP: ${sellerName} requests ${discountPercent.toFixed(1)}% discount on ${productName}. ` +
      `Open KobeERP to approve or reject.`;
    await this.send(ownerPhone, msg);
  }
}
