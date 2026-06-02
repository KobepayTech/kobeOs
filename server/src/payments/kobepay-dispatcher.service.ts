import { Injectable, Logger } from '@nestjs/common';
import { PaymentCustomer, PaymentDeposit } from './kobepay.entity';

export interface DispatchPayload {
  kobepayReceiptId: string;
  kobepayBusinessName: string;
  customerPhone: string;
  customerName: string;
  supplierPhone: string;
  supplierName: string;
  sentAmount: number;
  sentCurrency: string;
  exchangeRate: number;
  supplierReceivedAmount: number;
  supplierCurrency: string;
  supplierCity: string;
  poNumber: string;
}

/**
 * Pushes a receipt from KobePay (this install) to the ERP customer's
 * install over HTTPS. Authenticates with the client's pre-shared
 * apiKey via a Bearer header.
 *
 * Failures are logged but do NOT roll back the deposit — the receipt
 * push is a best-effort downstream notification. A future retry queue
 * can replay failed dispatches from the deposit row.
 */
@Injectable()
export class KobepayDispatcherService {
  private readonly log = new Logger(KobepayDispatcherService.name);

  /** Override in tests via setHttpClient. Defaults to global fetch. */
  private httpClient: typeof fetch = (input, init) => fetch(input, init);

  setHttpClient(client: typeof fetch) {
    this.httpClient = client;
  }

  /**
   * Dispatch a single confirmed deposit to the client's ERP inbox.
   * Returns { ok, status, error? } so the caller can audit the result
   * without rethrowing.
   */
  async dispatchDeposit(
    client: PaymentCustomer,
    deposit: PaymentDeposit,
    kobepayBusinessName: string,
  ): Promise<{ ok: boolean; status?: number; error?: string }> {
    if (!client.erpEndpointUrl || !client.erpApiKey) {
      return { ok: false, error: 'Client has no ERP endpoint configured' };
    }
    const supplier = deposit.suppliers?.[0];
    const payload: DispatchPayload = {
      kobepayReceiptId: deposit.id,
      kobepayBusinessName,
      customerPhone: deposit.phone,
      customerName: deposit.customerName,
      supplierPhone: supplier?.supplierNumber ?? '',
      supplierName: supplier?.supplierName ?? '',
      sentAmount: Number(deposit.amount),
      sentCurrency: deposit.cashCurrency || deposit.currency,
      exchangeRate: Number(deposit.salesRate),
      supplierReceivedAmount: Number(deposit.targetAmount),
      supplierCurrency: deposit.targetCurrency,
      supplierCity: supplier?.city ?? deposit.supplierCity ?? '',
      poNumber: '',
    };

    try {
      const res = await this.httpClient(client.erpEndpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${client.erpApiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.log.warn(`Dispatch to ${client.erpEndpointUrl} failed: ${res.status} ${text}`);
        return { ok: false, status: res.status, error: text || res.statusText };
      }
      return { ok: true, status: res.status };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(`Dispatch to ${client.erpEndpointUrl} threw: ${msg}`);
      return { ok: false, error: msg };
    }
  }
}
