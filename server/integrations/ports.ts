export type PaymentProvider = 'orange_money' | 'telecel';
export type PaymentProviderMode = 'simulated' | 'sandbox' | 'live';
export type PaymentIntentState = 'pending' | 'confirmed' | 'failed';

export interface PaymentIntentInput {
  transactionId: string;
  amountXOF: number;
  payerName: string;
  payerPhone: string;
  description: string;
  provider: PaymentProvider;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  providerRef: string;
  state: PaymentIntentState;
  mode: PaymentProviderMode;
  checkoutUrl?: string;
  instructions?: string;
}

export interface PaymentWebhookEvent {
  providerRef: string;
  state: PaymentIntentState;
  amountXOF?: number;
  transactionId?: string;
  rawStatus?: string;
}

export interface PaymentProviderAdapter {
  provider: PaymentProvider;
  mode: PaymentProviderMode;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  verifyWebhook(payload: unknown, signature: string | undefined): boolean;
  parseWebhook(payload: unknown): PaymentWebhookEvent | null;
}
