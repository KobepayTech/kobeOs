'use strict';

const https = require('https');

/**
 * Kobe Payment Driver
 *
 * User-space driver for payment terminal integration.
 * Supports two modes:
 *
 *   1. Cloud gateway (Stripe, Flutterwave, Paystack) — HTTP API calls
 *   2. Local terminal (PAX, Ingenico, Verifone) — TCP socket or serial
 *
 * All payment flows go through this driver so the POS app never
 * holds API keys or talks to payment networks directly.
 * Keys are stored in the Electron main process and injected at runtime.
 */
class PaymentDriver {
  constructor() {
    this.type    = 'payment';
    this.version = '1.0.0';
    this._gateways = new Map();   // name → config
    this._terminals = new Map();  // terminalId → connection
    this._transactions = new Map(); // txId → status
  }

  get name() { return 'KobePaymentDriver'; }

  // ── Gateway Registration ─────────────────────────────────────────────────

  registerGateway(name, config) {
    // config: { provider, apiKey, secretKey, baseUrl, currency }
    this._gateways.set(name, { ...config, name });
    return { status: 'registered', name };
  }

  // ── Charge ───────────────────────────────────────────────────────────────

  /**
   * Initiate a charge via a registered gateway.
   * Returns a transaction object with id and status.
   */
  async charge(gatewayName, amount, currency, metadata = {}) {
    const gw = this._gateways.get(gatewayName);
    if (!gw) throw new Error(`Gateway not registered: ${gatewayName}`);

    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this._transactions.set(txId, { txId, status: 'pending', amount, currency, gateway: gatewayName });

    try {
      let result;
      switch (gw.provider) {
        case 'stripe':      result = await this._stripeCharge(gw, txId, amount, currency, metadata); break;
        case 'flutterwave': result = await this._flutterwaveCharge(gw, txId, amount, currency, metadata); break;
        case 'paystack':    result = await this._paystackCharge(gw, txId, amount, currency, metadata); break;
        default: throw new Error(`Unknown provider: ${gw.provider}`);
      }
      this._transactions.set(txId, { ...this._transactions.get(txId), ...result, status: 'success' });
      return this._transactions.get(txId);
    } catch (err) {
      this._transactions.set(txId, { ...this._transactions.get(txId), status: 'failed', error: err.message });
      throw err;
    }
  }

  async _stripeCharge(gw, txId, amount, currency, metadata) {
    const body = new URLSearchParams({
      amount:   String(Math.round(amount * 100)), // Stripe uses cents
      currency: currency.toLowerCase(),
      'metadata[txId]': txId,
      ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v])),
    }).toString();

    return this._httpPost('api.stripe.com', '/v1/payment_intents', body, {
      Authorization: `Bearer ${gw.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    });
  }

  async _flutterwaveCharge(gw, txId, amount, currency, metadata) {
    const body = JSON.stringify({ tx_ref: txId, amount, currency, ...metadata });
    return this._httpPost('api.flutterwave.com', '/v3/charges?type=card', body, {
      Authorization: `Bearer ${gw.secretKey}`,
      'Content-Type': 'application/json',
    });
  }

  async _paystackCharge(gw, txId, amount, currency, metadata) {
    const body = JSON.stringify({ reference: txId, amount: Math.round(amount * 100), currency, metadata });
    return this._httpPost('api.paystack.co', '/transaction/initialize', body, {
      Authorization: `Bearer ${gw.secretKey}`,
      'Content-Type': 'application/json',
    });
  }

  _httpPost(host, path, body, headers) {
    return new Promise((resolve, reject) => {
      const req = https.request({ host, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // ── Refund ───────────────────────────────────────────────────────────────

  async refund(txId, amount) {
    const tx = this._transactions.get(txId);
    if (!tx) throw new Error(`Transaction not found: ${txId}`);
    // Refund logic is gateway-specific — placeholder
    return { status: 'refund-initiated', txId, amount };
  }

  // ── Transaction History ──────────────────────────────────────────────────

  getTransaction(txId) {
    return this._transactions.get(txId) || null;
  }

  listTransactions() {
    return [...this._transactions.values()];
  }

  send(deviceId, command, data) {
    switch (command) {
      case 'registerGateway': return this.registerGateway(data?.name, data?.config);
      case 'charge':          return this.charge(data?.gateway, data?.amount, data?.currency, data?.metadata);
      case 'refund':          return this.refund(data?.txId, data?.amount);
      case 'getTransaction':  return this.getTransaction(data?.txId);
      case 'listTransactions': return this.listTransactions();
      default: throw new Error(`Unknown payment command: ${command}`);
    }
  }

  getStatus() {
    return {
      type:         this.type,
      gateways:     this._gateways.size,
      transactions: this._transactions.size,
    };
  }
}

module.exports = PaymentDriver;
