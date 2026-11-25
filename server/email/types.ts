/**
 * Tipos do módulo de email do Guigui.com.
 *
 * O domínio é deliberadamente independente do fornecedor: o dispatcher só
 * conhece `EmailProvider`, pelo que Brevo (API) e SMTP (Nodemailer/Mailpit)
 * são intercambiáveis e testáveis.
 */

export type EmailLocale = 'pt' | 'fr' | 'en' | 'es';

/**
 * Tipos de email realmente enviados hoje. Novos fluxos acrescentam o seu tipo
 * aqui quando forem ligados, em vez de manter um catálogo de intenções.
 */
export type EmailKind = 'team_invitation' | 'ticket_delivery' | 'password_reset' | 'external_message';

/**
 * Estados de entrega.
 *
 * `accepted` significa apenas que o fornecedor aceitou a mensagem (2xx ou
 * aceitação SMTP). `delivered` só pode ser atribuído por confirmação do
 * fornecedor (webhook), nunca pela resposta do envio.
 */
export type EmailDeliveryStatus =
  | 'queued'
  | 'accepted'
  | 'delivered'
  | 'bounced'
  | 'rejected'
  | 'failed'
  | 'complained';

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

/** Mensagem pronta a enviar, já renderizada pelo catálogo de templates. */
export interface OutgoingEmail extends EmailContent {
  to: EmailAddress;
  kind: EmailKind;
  locale: EmailLocale;
  /**
   * Chave de idempotência. Duas chamadas com a mesma chave produzem um único
   * envio, mesmo em retry, webhook repetido ou pedido duplicado do cliente.
   */
  dedupeKey?: string;
  replyTo?: EmailAddress;
  relatedUserId?: string;
  metadata?: Record<string, string>;
}

export type EmailProviderName = 'brevo' | 'smtp';
export type EmailProviderMode = 'live' | 'development';

/** Mensagem no formato que o adapter do fornecedor espera. */
export interface EmailProviderMessage {
  from: EmailAddress;
  to: EmailAddress;
  replyTo?: EmailAddress;
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface EmailProviderReceipt {
  providerMessageId: string;
  acceptedAt: Date;
}

/**
 * Falha devolvida pelo fornecedor.
 *
 * `retriable` decide se o dispatcher volta a tentar; `outcome` decide o estado
 * final quando não há mais tentativas (recusa definitiva vs. falha técnica).
 */
export class EmailProviderError extends Error {
  readonly code: string;
  readonly retriable: boolean;
  readonly outcome: 'rejected' | 'failed';
  readonly providerMessage?: string;
  readonly httpStatus?: number;

  constructor(input: {
    code: string;
    message: string;
    retriable: boolean;
    outcome: 'rejected' | 'failed';
    providerMessage?: string;
    httpStatus?: number;
  }) {
    super(input.message);
    this.name = 'EmailProviderError';
    this.code = input.code;
    this.retriable = input.retriable;
    this.outcome = input.outcome;
    this.providerMessage = input.providerMessage;
    this.httpStatus = input.httpStatus;
  }
}

export class EmailConfigurationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = 'EmailConfigurationError';
    this.issues = issues;
  }
}

export interface EmailProvider {
  readonly name: EmailProviderName;
  readonly mode: EmailProviderMode;
  send(message: EmailProviderMessage): Promise<EmailProviderReceipt>;
}

/** Registo persistido de uma tentativa de envio (tabela `email_deliveries`). */
export interface EmailDeliveryRecord {
  id: string;
  kind: EmailKind;
  locale: EmailLocale;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  status: EmailDeliveryStatus;
  provider: EmailProviderName;
  mode: EmailProviderMode;
  providerMessageId: string | null;
  dedupeKey: string | null;
  attempts: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  relatedUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
  finalizedAt: string | null;
}
