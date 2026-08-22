import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AccountingCallRequest { to: string; prompt: string; callbackToken: string; callbackUrl: string }
export interface AccountingCallResult { provider: string; providerCallId: string; status: 'QUEUED' | 'RINGING' | 'FAILED'; payload: Record<string, unknown> }

/** Provider-neutral outbound-call adapter. ACCOUNTING_VOICE_WEBHOOK can point
 * at Beem Voice, Twilio, Africa's Talking or an internal SIP worker without
 * coupling the accounting workflow to one vendor. */
@Injectable()
export class AccountingCallProvider {
  private readonly logger = new Logger(AccountingCallProvider.name);
  constructor(private readonly config: ConfigService) {}

  async call(input: AccountingCallRequest): Promise<AccountingCallResult> {
    const endpoint = this.config.get<string>('ACCOUNTING_VOICE_WEBHOOK');
    const secret = this.config.get<string>('ACCOUNTING_VOICE_SECRET');
    if (!endpoint) return { provider: 'development-queue', providerCallId: `queued-${Date.now()}`, status: 'QUEUED', payload: { configured: false } };
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error(`Voice provider HTTP ${response.status}`);
      return { provider: String(payload.provider ?? 'voice-webhook'), providerCallId: String(payload.callId ?? payload.id ?? `call-${Date.now()}`), status: 'RINGING', payload };
    } catch (error) {
      this.logger.warn(`Accounting call failed: ${(error as Error).message}`);
      return { provider: 'voice-webhook', providerCallId: '', status: 'FAILED', payload: { error: (error as Error).message } };
    }
  }
}
