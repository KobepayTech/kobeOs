export type SocialPaymentState = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REVIEW';

export interface SocialCheckoutPayment {
  orderNumber: string;
  paymentState: SocialPaymentState;
  amount: number;
  currency: string;
}

export const socialPaymentMessage: Record<SocialPaymentState, string> = {
  PENDING: 'Approve the mobile-money prompt on your phone. This page updates when PalmPesa verifies the payment.',
  PAID: 'Payment verified. The shop can now prepare your order.',
  FAILED: 'The payment did not complete. Return to the shop to start a new checkout.',
  EXPIRED: 'The payment request expired. If your wallet was debited, contact the shop with your order number.',
  REVIEW: 'PalmPesa confirmed a late payment. Contact the shop with your order number so they can review it.',
};
