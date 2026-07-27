import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

interface PayPalLink {
  href: string;
  rel: string;
  method?: string;
}

interface PayPalOrder {
  id: string;
  status: string;
  links?: PayPalLink[];
}

@Injectable()
export class PayPalCheckoutService {
  private accessToken = '';
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('PAYPAL_CLIENT_ID') &&
      !!this.config.get<string>('PAYPAL_CLIENT_SECRET');
  }

  private get apiBase(): string {
    return this.config.get<string>('PAYPAL_ENV', 'sandbox') === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private async token(): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
      );
    }
    if (this.accessToken && this.tokenExpiresAt > Date.now() + 60_000) {
      return this.accessToken;
    }

    const clientId = this.config.get<string>('PAYPAL_CLIENT_ID', '');
    const secret = this.config.get<string>('PAYPAL_CLIENT_SECRET', '');
    const response = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const body = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
    if (!response.ok || !body.access_token) {
      throw new ServiceUnavailableException(
        body.error_description ?? `PayPal authentication returned ${response.status}`,
      );
    }
    this.accessToken = body.access_token;
    this.tokenExpiresAt = Date.now() + (body.expires_in ?? 300) * 1000;
    return this.accessToken;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.token();
    const response = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = { message: text }; }
    if (!response.ok) {
      const message = typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : `PayPal returned ${response.status}`;
      throw new ServiceUnavailableException(message);
    }
    return body as T;
  }

  async createOrder(params: {
    appId: string;
    appName: string;
    amountUsd: number;
    entitlementId: string;
  }): Promise<{ orderId: string; approvalUrl: string }> {
    const publicUrl = this.config.get<string>('APP_PUBLIC_URL', 'http://localhost:5173');
    const order = await this.request<PayPalOrder>('/v2/checkout/orders', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `app-${params.entitlementId}-${randomUUID()}` },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: params.entitlementId,
          custom_id: params.appId,
          description: `${params.appName} — KobeOS 30-day access`,
          amount: {
            currency_code: 'USD',
            value: params.amountUsd.toFixed(2),
          },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'KobeOS',
              user_action: 'PAY_NOW',
              return_url: `${publicUrl}/store?paypal=approved&appId=${encodeURIComponent(params.appId)}`,
              cancel_url: `${publicUrl}/store?paypal=cancelled&appId=${encodeURIComponent(params.appId)}`,
            },
          },
        },
      }),
    });
    const approvalUrl = order.links?.find((link) =>
      link.rel === 'payer-action' || link.rel === 'approve'
    )?.href;
    if (!approvalUrl) {
      throw new ServiceUnavailableException('PayPal did not return an approval link.');
    }
    return { orderId: order.id, approvalUrl };
  }

  captureOrder(orderId: string): Promise<PayPalOrder> {
    return this.request<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `capture-${orderId}` },
      body: '{}',
    });
  }
}
