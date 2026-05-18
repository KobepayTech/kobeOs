import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

// ── Response shapes ───────────────────────────────────────────────────────────

export interface PalmPesaInitiateResponse {
  message: string;
  order_id: string;
}

export interface PalmPesaOrderData {
  order_id: string;
  creation_date: string;
  amount: string;
  payment_status: 'COMPLETED' | 'PENDING' | 'FAILED' | string;
  transid: string;
  channel: string;
  reference: string;
  msisdn: string;
}

export interface PalmPesaOrderStatusResponse {
  reference: string;
  resultcode: string;
  result: string;
  message: string;
  data: PalmPesaOrderData[];
}

// ── Callback payload shape (sent to our webhook URL) ─────────────────────────

export interface PalmPesaCallback {
  order_id: string;
  payment_status: 'COMPLETED' | 'PENDING' | 'FAILED' | string;
  // Extended fields present in some callbacks
  reference?: string;
  resultcode?: string;
  data?: PalmPesaOrderData[];
}

@Injectable()
export class PalmPesaService {
  private readonly logger = new Logger(PalmPesaService.name);
  private readonly base = 'https://palmpesa.drmlelwa.co.tz';

  // Baked-in defaults — override via env vars for white-label deployments
  private static readonly DEFAULT_API_TOKEN =
    '0HNndAwG6NIXcksD1kRxHVHMgUtDi8GqgMfMQrymleH8HluAdA1ZRAl2jG3B';
  private static readonly DEFAULT_USER_ID = 531;

  constructor(private readonly config: ConfigService) {}

  private get apiToken(): string {
    return this.config.get<string>('PALMPESA_API_TOKEN', PalmPesaService.DEFAULT_API_TOKEN);
  }

  private get userId(): number {
    return this.config.get<number>('PALMPESA_USER_ID', PalmPesaService.DEFAULT_USER_ID);
  }

  get callbackBase(): string {
    return this.config.get<string>('APP_PUBLIC_URL', 'https://api.kobeapptz.com');
  }

  // ── Initiate USSD push payment ────────────────────────────────────────────

  /**
   * Send a USSD push to the creator's phone to collect the subscription fee.
   * Returns the PalmPesa order_id — store this to track payment status.
   */
  async initiatePayment(params: {
    name: string;
    email: string;
    phone: string;
    amountTzs: number;
    transactionId: string;
    description: string;
  }): Promise<PalmPesaInitiateResponse> {
    const { name, email, phone, amountTzs, transactionId, description } = params;

    // Normalise phone: strip leading + or 0, ensure 255 prefix
    const normPhone = this.normalisePhone(phone);

    const body = {
      name,
      email,
      phone: normPhone,
      amount: Math.round(amountTzs),
      transaction_id: transactionId,
      address: 'Tanzania',
      postcode: '00000',
      callback_url: `${this.callbackBase}/api/webhooks/palmpesa`,
    };

    this.logger.log(`Initiating PalmPesa payment: ${transactionId} — ${amountTzs} TZS → ${normPhone}`);

    const res = await this.post<PalmPesaInitiateResponse>('/api/palmpesa/initiate', body);
    this.logger.log(`PalmPesa initiated: order_id=${res.order_id}`);
    return res;
  }

  // ── Check order status ────────────────────────────────────────────────────

  async getOrderStatus(orderId: string): Promise<PalmPesaOrderStatusResponse> {
    return this.post<PalmPesaOrderStatusResponse>('/api/order-status', { order_id: orderId });
  }

  /** Poll until COMPLETED/FAILED or timeout (max 3 min, 10s intervals). */
  async pollUntilSettled(
    orderId: string,
    maxAttempts = 18,
  ): Promise<PalmPesaOrderData | null> {
    for (let i = 0; i < maxAttempts; i++) {
      await this.sleep(10_000);
      try {
        const status = await this.getOrderStatus(orderId);
        const data = status.data?.[0];
        if (data && ['COMPLETED', 'FAILED'].includes(data.payment_status)) {
          return data;
        }
      } catch (err) {
        this.logger.warn(`Poll attempt ${i + 1} failed: ${(err as Error).message}`);
      }
    }
    return null; // timed out — rely on webhook callback
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Generate a unique transaction ID for a subscription charge. */
  generateTxId(creatorId: string, tier: string): string {
    const ts = Date.now();
    return `SUB-${tier.toUpperCase()}-${creatorId.slice(0, 8)}-${ts}`;
  }

  private normalisePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('255')) return digits;
    if (digits.startsWith('0'))   return `255${digits.slice(1)}`;
    if (digits.startsWith('7') || digits.startsWith('6')) return `255${digits}`;
    return digits;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.base}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!res.ok) {
      throw new ServiceUnavailableException(
        `PalmPesa ${path} returned ${res.status}: ${text.slice(0, 200)}`,
      );
    }

    return json as T;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
