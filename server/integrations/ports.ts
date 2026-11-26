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

/**
 * Resultado de uma entrega externa.
 *
 * `accepted` significa que o fornecedor aceitou a mensagem; não é `delivered`.
 * `simulated` continua a existir para os fluxos sem fornecedor configurado.
 */
export interface IntegrationDeliveryResult {
  mode: 'simulated' | 'development' | 'live';
  state: 'simulated' | 'accepted' | 'rejected' | 'failed';
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

export interface PasswordResetEmailInput {
  recipientEmail: string;
  recipientName: string;
  token: string;
  expiresInMinutes?: number;
}

export interface TeamInvitationEmailInput {
  invitationId: string;
  recipientEmail: string;
  recipientName: string;
  businessName: string;
  roleLabel: string;
  invitationUrl: string;
  /** Nome apresentado ao convidado; por omissão usa `businessName`. */
  organizationName?: string;
  modules?: string[];
  isAdminScope?: boolean;
}

export interface SmsDeliveryInput {
  to: string;
  text: string;
  reference: string;
}

export interface EmailDeliveryPort {
  sendTicketPurchase(input: TicketPurchaseEmailInput): Promise<IntegrationDeliveryResult>;
  sendTeamInvitation(input: TeamInvitationEmailInput): Promise<IntegrationDeliveryResult>;
  sendPasswordReset(input: PasswordResetEmailInput): Promise<IntegrationDeliveryResult>;
}

export interface SmsDeliveryPort {
  send(input: SmsDeliveryInput): Promise<IntegrationDeliveryResult>;
}
