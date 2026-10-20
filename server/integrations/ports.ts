import type { TicketForValidation } from '../validationService';

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

export interface IntegrationDeliveryResult {
  mode: 'simulated';
  state: 'simulated';
  reference: string;
}

export interface TicketPurchaseEmailInput {
  transactionId: string;
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  totalAmountXOF: number;
  tickets: TicketForValidation[];
}

export interface TeamInvitationEmailInput {
  invitationId: string;
  recipientEmail: string;
  recipientName: string;
  businessName: string;
  roleLabel: string;
  invitationUrl: string;
}

export interface SmsDeliveryInput {
  to: string;
  text: string;
  reference: string;
}

export interface EmailDeliveryPort {
  sendTicketPurchase(input: TicketPurchaseEmailInput): Promise<IntegrationDeliveryResult>;
  sendTeamInvitation(input: TeamInvitationEmailInput): Promise<IntegrationDeliveryResult>;
}

export interface SmsDeliveryPort {
  send(input: SmsDeliveryInput): Promise<IntegrationDeliveryResult>;
}
