import nodemailer from 'nodemailer';
import {
  EmailProviderError,
  type EmailProvider,
  type EmailProviderMessage,
  type EmailProviderMode,
} from '../types';
import { formatEmailAddress } from '../validation';

/**
 * Adapter SMTP (Nodemailer).
 *
 * Serve dois cenários diferentes, ambos explícitos:
 * - desenvolvimento: Mailpit em 127.0.0.1:1025, sem autenticação, `mode: development`;
 * - produção: relay SMTP autenticado com `mode: live`.
 *
 * O resultado é `accepted` quando o servidor SMTP aceita o destinatário; a
 * entrega final continua a depender de confirmação externa.
 */

export interface SmtpTransport {
  sendMail(message: Record<string, unknown>): Promise<{
    messageId?: string;
    accepted?: unknown[];
    rejected?: unknown[];
    response?: string;
  }>;
}

export interface SmtpProviderInput {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  timeoutMs?: number;
  mode: EmailProviderMode;
  transport?: SmtpTransport;
}

function createTransport(input: SmtpProviderInput): SmtpTransport {
  if (input.transport) return input.transport;
  const timeout = input.timeoutMs ?? 15_000;
  const transporter = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: input.secure,
    ...(input.user && input.password ? { auth: { user: input.user, pass: input.password } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: timeout,
  });
  return transporter as unknown as SmtpTransport;
}

interface SmtpFailureShape {
  code?: unknown;
  responseCode?: unknown;
  message?: unknown;
  response?: unknown;
}

function classifySmtpFailure(error: unknown): EmailProviderError {
  const failure: SmtpFailureShape =
    error && typeof error === 'object' ? (error as SmtpFailureShape) : {};
  const code = typeof failure.code === 'string' ? failure.code : '';
  const responseCode = typeof failure.responseCode === 'number' ? failure.responseCode : undefined;
  const providerMessage =
    typeof failure.response === 'string'
      ? failure.response
      : typeof failure.message === 'string'
        ? failure.message
        : String(error);

  // Erros de autenticação/forma têm precedência sobre o código numérico: o
  // Nodemailer devolve 535 (5xx) em EAUTH e seria mal classificado como recusa
  // definitiva do destinatário.
  if (code === 'EAUTH' || code === 'EENVELOPE' || code === 'EMESSAGE') {
    return new EmailProviderError({
      code: code === 'EAUTH' ? 'smtp_auth_failed' : 'smtp_rejected',
      message:
        code === 'EAUTH'
          ? 'O servidor SMTP recusou as credenciais.'
          : 'O servidor SMTP recusou a mensagem.',
      retriable: false,
      outcome: code === 'EAUTH' ? 'failed' : 'rejected',
      providerMessage,
    });
  }

  // 5xx SMTP é definitivo (destinatário recusado, política); 4xx é transitório.
  if (responseCode !== undefined) {
    const retriable = responseCode >= 400 && responseCode < 500;
    return new EmailProviderError({
      code: retriable ? 'smtp_temporary_failure' : 'smtp_recipient_rejected',
      message: retriable
        ? 'O servidor SMTP recusou temporariamente a mensagem.'
        : 'O servidor SMTP recusou a mensagem de forma definitiva.',
      retriable,
      outcome: retriable ? 'failed' : 'rejected',
      providerMessage,
      httpStatus: responseCode,
    });
  }

  const retriable = ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ECONNRESET', 'EPROTOCOL', ''].includes(
    code,
  );
  return new EmailProviderError({
    code: retriable ? 'smtp_network_error' : 'smtp_failed',
    message: retriable
      ? 'Não foi possível concluir o envio por SMTP.'
      : 'O servidor SMTP devolveu um erro inesperado.',
    retriable,
    outcome: 'failed',
    providerMessage,
  });
}

export function createSmtpEmailProvider(input: SmtpProviderInput): EmailProvider {
  const transport = createTransport(input);

  return {
    name: 'smtp',
    mode: input.mode,
    async send(message: EmailProviderMessage) {
      const options: Record<string, unknown> = {
        from: formatEmailAddress(message.from),
        to: formatEmailAddress(message.to),
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { replyTo: formatEmailAddress(message.replyTo) } : {}),
        ...(message.headers ? { headers: message.headers } : {}),
        ...(message.attachments.length > 0
          ? {
              attachments: message.attachments.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content,
                ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
              })),
            }
          : {}),
      };

      let info: Awaited<ReturnType<SmtpTransport['sendMail']>>;
      try {
        info = await transport.sendMail(options);
      } catch (error) {
        throw classifySmtpFailure(error);
      }

      const accepted = Array.isArray(info.accepted) ? info.accepted.length : 0;
      const rejected = Array.isArray(info.rejected) ? info.rejected : [];
      if (accepted === 0 && rejected.length > 0) {
        throw new EmailProviderError({
          code: 'smtp_recipient_rejected',
          message: 'O servidor SMTP recusou o destinatário da mensagem.',
          retriable: false,
          outcome: 'rejected',
          providerMessage: rejected.map(String).join(', ').slice(0, 500),
        });
      }

      return {
        providerMessageId:
          (typeof info.messageId === 'string' && info.messageId) ||
          `smtp-${Date.now().toString(36)}`,
        acceptedAt: new Date(),
      };
    },
  };
}
