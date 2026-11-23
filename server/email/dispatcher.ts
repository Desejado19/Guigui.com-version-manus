import { randomUUID } from 'node:crypto';
import type { EmailDeliveryRepository } from './deliveryRepository';
import {
  EmailProviderError,
  type EmailAddress,
  type EmailDeliveryRecord,
  type EmailDeliveryStatus,
  type EmailProvider,
  type EmailProviderMessage,
  type OutgoingEmail,
} from './types';
import { describeRecipient, normaliseEmailAddress, validateEmailContent } from './validation';

/**
 * Dispatcher central de email.
 *
 * Responsabilidades:
 * 1. validar destinatário e conteúdo antes de qualquer envio;
 * 2. registar a tentativa (`queued`) para que o painel admin mostre também as
 *    falhas — nunca só os sucessos;
 * 3. respeitar `dedupeKey`: a mesma mensagem lógica não é enviada duas vezes;
 * 4. repetir apenas falhas transitórias (timeout, rede, 429, 5xx), com backoff
 *    exponencial e um máximo de tentativas;
 * 5. gravar o estado final. `accepted` não é `delivered`: a entrega só é
 *    confirmada pelo fornecedor (webhook, fase seguinte).
 */

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 30_000;

export interface EmailDispatcherLogger {
  warn(event: string, detail?: Record<string, unknown>): void;
  error(event: string, detail?: Record<string, unknown>): void;
}

export interface EmailDispatcherDependencies {
  provider: EmailProvider;
  repository: EmailDeliveryRepository;
  from: EmailAddress;
  replyTo?: EmailAddress;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  /** Permitido apenas quando SMTP aponta para Mailpit em desenvolvimento. */
  allowLocalDomain?: boolean;
  now?: () => Date;
  delay?: (milliseconds: number) => Promise<void>;
  logger?: EmailDispatcherLogger;
}

export interface EmailDispatchOutcome {
  deliveryId: string;
  state: EmailDeliveryStatus;
  attempts: number;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  deduplicated: boolean;
}

export interface EmailDispatcher {
  dispatch(email: OutgoingEmail): Promise<EmailDispatchOutcome>;
}

const consoleLogger: EmailDispatcherLogger = {
  warn(event, detail) {
    console.warn(`[Guigui.com] ${event}`, detail ?? {});
  },
  error(event, detail) {
    console.error(`[Guigui.com] ${event}`, detail ?? {});
  },
};

function toOutcome(record: EmailDeliveryRecord, deduplicated: boolean): EmailDispatchOutcome {
  return {
    deliveryId: record.id,
    state: record.status,
    attempts: record.attempts,
    providerMessageId: record.providerMessageId,
    errorCode: record.lastErrorCode,
    errorMessage: record.lastErrorMessage,
    deduplicated,
  };
}

function toProviderError(error: unknown): EmailProviderError {
  if (error instanceof EmailProviderError) return error;
  return new EmailProviderError({
    code: 'provider_unexpected_error',
    message: 'O fornecedor de email devolveu um erro inesperado.',
    // Um erro desconhecido pode ser transitório (rede, processo reiniciado).
    retriable: true,
    outcome: 'failed',
    providerMessage: error instanceof Error ? error.message : String(error),
  });
}

function createDeliveryId(): string {
  return `email-${randomUUID()}`;
}

export function createEmailDispatcher(
  dependencies: EmailDispatcherDependencies,
): EmailDispatcher {
  const maxAttempts = Math.min(Math.max(dependencies.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 1), 5);
  const retryBaseDelayMs = Math.max(
    dependencies.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
    0,
  );
  const now = dependencies.now ?? (() => new Date());
  const delay =
    dependencies.delay ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const logger = dependencies.logger ?? consoleLogger;

  async function recordRejected(
    email: OutgoingEmail,
    recipientEmail: string,
    recipientName: string | undefined,
    subject: string,
    code: string,
    message: string,
  ): Promise<EmailDispatchOutcome> {
    const createdAt = now();
    const { record, duplicate } = await dependencies.repository.create({
      id: createDeliveryId(),
      kind: email.kind,
      locale: email.locale,
      recipientEmail,
      recipientName,
      subject,
      provider: dependencies.provider.name,
      mode: dependencies.provider.mode,
      status: 'rejected',
      dedupeKey: email.dedupeKey?.trim().slice(0, 200) || undefined,
      relatedUserId: email.relatedUserId,
      metadata: email.metadata,
      errorCode: code,
      errorMessage: message,
      createdAt,
    });
    logger.warn('email-delivery-rejected-before-send', {
      deliveryId: record.id,
      kind: email.kind,
      code,
    });
    return toOutcome(record, duplicate);
  }

  return {
    async dispatch(email: OutgoingEmail): Promise<EmailDispatchOutcome> {
      const recipient = normaliseEmailAddress(email.to, {
        allowLocalDomain: dependencies.allowLocalDomain,
      });
      if (!recipient.ok || !recipient.value) {
        return recordRejected(
          email,
          describeRecipient(email.to),
          undefined,
          String(email.subject ?? '').slice(0, 200),
          recipient.code ?? 'recipient_invalid',
          recipient.message ?? 'O endereço do destinatário não é válido.',
        );
      }

      const content = validateEmailContent(email);
      if (!content.ok || !content.value) {
        return recordRejected(
          email,
          recipient.value.email,
          recipient.value.name,
          String(email.subject ?? '').slice(0, 200),
          content.code ?? 'content_invalid',
          content.message ?? 'O conteúdo do email não é válido.',
        );
      }

      const createdAt = now();
      const { record, duplicate } = await dependencies.repository.create({
        id: createDeliveryId(),
        kind: email.kind,
        locale: email.locale,
        recipientEmail: recipient.value.email,
        recipientName: recipient.value.name,
        subject: content.value.subject,
        provider: dependencies.provider.name,
        mode: dependencies.provider.mode,
        status: 'queued',
        dedupeKey: email.dedupeKey?.trim().slice(0, 200) || undefined,
        relatedUserId: email.relatedUserId,
        metadata: email.metadata,
        createdAt,
      });

      if (duplicate) {
        logger.warn('email-delivery-deduplicated', {
          deliveryId: record.id,
          kind: record.kind,
          state: record.status,
        });
        return toOutcome(record, true);
      }

      const providerMessage: EmailProviderMessage = {
        from: dependencies.from,
        to: recipient.value,
        replyTo: email.replyTo ?? dependencies.replyTo,
        subject: content.value.subject,
        html: content.value.html,
        text: content.value.text,
        attachments: content.value.attachments ?? [],
        headers: {
          'X-Guigui-Email-Kind': email.kind,
          'X-Guigui-Delivery-Id': record.id,
        },
      };

      let attempts = 0;
      let failure: EmailProviderError | null = null;

      while (attempts < maxAttempts) {
        attempts += 1;
        try {
          const receipt = await dependencies.provider.send(providerMessage);
          const finished = await dependencies.repository.finish(record.id, {
            status: 'accepted',
            attempts,
            providerMessageId: receipt.providerMessageId,
            acceptedAt: receipt.acceptedAt,
            at: now(),
          });
          return toOutcome(finished, false);
        } catch (error) {
          failure = toProviderError(error);
          logger.warn('email-delivery-attempt-failed', {
            deliveryId: record.id,
            kind: record.kind,
            attempt: attempts,
            code: failure.code,
            retriable: failure.retriable,
          });
          if (!failure.retriable || attempts >= maxAttempts) break;
          const backoff = Math.min(retryBaseDelayMs * 2 ** (attempts - 1), MAX_RETRY_DELAY_MS);
          await delay(backoff);
        }
      }

      const finalFailure =
        failure ??
        new EmailProviderError({
          code: 'provider_unavailable',
          message: 'Nenhuma tentativa de envio foi concluída.',
          retriable: false,
          outcome: 'failed',
        });

      const finished = await dependencies.repository.finish(record.id, {
        status: finalFailure.outcome,
        attempts,
        errorCode: finalFailure.code,
        errorMessage: finalFailure.providerMessage
          ? `${finalFailure.message} (${finalFailure.providerMessage})`.slice(0, 1000)
          : finalFailure.message,
        at: now(),
      });
      if (finalFailure.outcome === 'failed') {
        logger.error('email-delivery-failed', {
          deliveryId: record.id,
          kind: record.kind,
          attempts,
          code: finalFailure.code,
        });
      }
      return toOutcome(finished, false);
    },
  };
}
