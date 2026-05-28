// ============================================================================
// PAYMENTS INTEGRATION
// ============================================================================
// Unified payment layer supporting:
// - KobePay (internal wallet)
// - Palmpesa (Tanzania mobile money)
// - Stripe (cards, international)
// - Bank transfers
// - Cash
// ============================================================================

import { useState, useCallback } from 'react';
import { api } from './kobeos-api-client';

// --- PAYMENT TYPES ---

export type PaymentProvider = 'kobepay' | 'palmpesa' | 'stripe' | 'bank' | 'cash';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  metadata: Record<string, any>;
  clientSecret?: string;
  checkoutUrl?: string;
  qrCode?: string;
  createdAt: string;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  provider: PaymentProvider;
  description: string;
  metadata?: Record<string, any>;
  redirectUrl?: string;
  customerPhone?: string;
  customerEmail?: string;
}

// --- KOBE PAY (Internal Wallet) ---

export const useKobePay = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBalance = useCallback(async () => {
    const res = await api.get<{ balance: number; currency: string; held: number }>('/payments/kobepay/balance');
    return res.data;
  }, []);

  const deposit = useCallback(async (amount: number, source: 'bank' | 'mobile-money') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<PaymentIntent>('/payments/kobepay/deposit', { amount, source });
      return res.data;
    } catch (err: any) {
      setError(err.message || 'Deposit failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const transfer = useCallback(async (recipientId: string, amount: number, note?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<PaymentIntent>('/payments/kobepay/transfer', { recipientId, amount, note });
      return res.data;
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const withdraw = useCallback(async (amount: number, destination: 'bank' | 'mobile-money', accountDetails: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<PaymentIntent>('/payments/kobepay/withdraw', { amount, destination, accountDetails });
      return res.data;
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getBalance, deposit, transfer, withdraw, isLoading, error };
};

// --- PALMPESA (Tanzania Mobile Money) ---

export const usePalmpesa = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = useCallback(async (data: {
    amount: number;
    phoneNumber: string;
    reference: string;
    description?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<{
        transactionId: string;
        status: string;
        instructions: string;
        ussdCode?: string;
      }>('/payments/palmpesa/initiate', {
        ...data,
        currency: 'TZS',
        provider: 'palmpesa',
      });
      return res.data;
    } catch (err: any) {
      setError(err.message || 'Palmpesa payment failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkStatus = useCallback(async (transactionId: string) => {
    const res = await api.get<{ status: string; amount: number; phoneNumber: string }>(
      '/payments/palmpesa/status',
      { transactionId }
    );
    return res.data;
  }, []);

  const handleWebhook = useCallback((payload: any) => {
    // Process Palmpesa webhook
    // Expected payload: { transactionId, status, amount, phoneNumber, reference, timestamp }
    console.log('[Palmpesa Webhook]', payload);
    // Emit event for UI update
    window.dispatchEvent(new CustomEvent('payment-update', { detail: payload }));
  }, []);

  return { initiatePayment, checkStatus, handleWebhook, isLoading, error };
};

// --- STRIPE (Cards & International) ---

export const useStripePayments = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPaymentIntent = useCallback(async (data: {
    amount: number;
    currency: string;
    customerEmail?: string;
    description?: string;
    metadata?: Record<string, any>;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<PaymentIntent>('/payments/stripe/intent', data);
      return res.data;
    } catch (err: any) {
      setError(err.message || 'Stripe payment failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmCardPayment = useCallback(async (clientSecret: string, cardElement: any) => {
    // This requires @stripe/stripe-js loaded
    // const stripe = await loadStripe(STRIPE_PUBLIC_KEY);
    // const result = await stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardElement } });
    // return result;

    // Stub for now — integrate with actual Stripe.js
    console.log('[Stripe] Confirming payment with client secret:', clientSecret);
    return { status: 'succeeded' };
  }, []);

  return { createPaymentIntent, confirmCardPayment, isLoading, error };
};

// --- UNIFIED PAYMENT HOOK ---

export const usePayment = () => {
  const kobePay = useKobePay();
  const palmpesa = usePalmpesa();
  const stripe = useStripePayments();
  const [activeProvider, setActiveProvider] = useState<PaymentProvider>('kobepay');

  const pay = useCallback(async (request: PaymentRequest) => {
    switch (request.provider) {
      case 'kobepay':
        return kobePay.transfer(request.metadata?.recipientId, request.amount, request.description);

      case 'palmpesa':
        return palmpesa.initiatePayment({
          amount: request.amount,
          phoneNumber: request.customerPhone || '',
          reference: request.metadata?.reference || `PAY-${Date.now()}`,
          description: request.description,
        });

      case 'stripe':
        return stripe.createPaymentIntent({
          amount: request.amount,
          currency: request.currency,
          customerEmail: request.customerEmail,
          description: request.description,
          metadata: request.metadata,
        });

      case 'bank':
        return api.post<PaymentIntent>('/payments/bank/transfer', {
          amount: request.amount,
          currency: request.currency,
          description: request.description,
          metadata: request.metadata,
        }).then(r => r.data);

      case 'cash':
        return api.post<PaymentIntent>('/payments/cash/record', {
          amount: request.amount,
          currency: request.currency,
          description: request.description,
          metadata: request.metadata,
        }).then(r => r.data);

      default:
        throw new Error(`Unsupported payment provider: ${request.provider}`);
    }
  }, [kobePay, palmpesa, stripe]);

  const getProviderStatus = useCallback(async () => {
    const res = await api.get<{
      kobepay: boolean;
      palmpesa: boolean;
      stripe: boolean;
      bank: boolean;
    }>('/payments/providers/status');
    return res.data;
  }, []);

  return {
    pay,
    getProviderStatus,
    activeProvider,
    setActiveProvider,
    kobePay,
    palmpesa,
    stripe,
  };
};

// --- PAYMENT QR GENERATOR ---

export const generatePaymentQR = (data: {
  amount: number;
  currency: string;
  recipientId: string;
  description: string;
  expiresAt?: string;
}): string => {
  const payload = {
    v: '1',
    type: 'payment',
    ...data,
    expiresAt: data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  return `https://pay.kobeos.app/?d=${btoa(JSON.stringify(payload))}`;
};

// --- PAYMENT STATUS POLLING ---

export const usePaymentStatus = (paymentId: string, interval: number = 3000) => {
  const [status, setStatus] = useState<string>('pending');
  const [payment, setPayment] = useState<PaymentIntent | null>(null);

  useEffect(() => {
    if (!paymentId) return;

    const check = async () => {
      const res = await api.get<PaymentIntent>(`/payments/${paymentId}`);
      if (res.data) {
        setPayment(res.data);
        setStatus(res.data.status);
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          clearInterval(timer);
        }
      }
    };

    check();
    const timer = setInterval(check, interval);
    return () => clearInterval(timer);
  }, [paymentId, interval]);

  return { status, payment };
};

// Required import for useEffect
import { useEffect } from 'react';

export default usePayment;
