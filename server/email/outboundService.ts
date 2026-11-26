import { createConfiguredEmailDispatcher } from './configured';
import { type EmailDeliveryRepository } from './deliveryRepository';
import type { EmailDispatchOutcome, EmailDispatcher } from './dispatcher';
import { renderEmailLayout } from './layout';
import { normaliseEmailAddress } from './validation';

/**
 * Email escrito pelo próprio utilizador (cidadão, empresa ou administração)
 * para um destinatário fora da plataforma.
 *
 * O `From` continua a ser o endereço verificado da plataforma — é o único que
 * alinha com SPF/DKIM/DMARC. A identidade do utilizador viaja no nome de
 * exibição e no `Reply-To`, pelo que quem responde fala directamente com ele.
 *
 * Não existe modo simulado para esta via: um email escrito por uma pessoa não
 * pode ser dado como enviado quando não saiu. Sem fornecedor configurado, a
 * operação falha com `EmailConfigurationError`.
 */

export const EXTERNAL_EMAIL_MAX_SUBJECT = 150;
export const EXTERNAL_EMAIL_MAX_MESSAGE = 4000;

export interface ExternalEmailSender {
  userId: string;
  name: string;
  email: string;
}

export interface ExternalEmailInput {
  sender: ExternalEmailSender;
  to: string;
  subject: string;
  message: string;
  /** Chave de idempotência opcional enviada pelo cliente (repetição segura). */
  requestId?: string;
}

export class ExternalEmailValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ExternalEmailValidationError';
    this.code = code;
  }
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function normaliseSubject(value: string): string {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseMessage(value: string): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARACTERS, '')
    .trim();
}

export interface RenderedExternalEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderExternalEmail(input: {
  sender: ExternalEmailSender;
  subject: string;
  message: string;
  appUrl?: string;
}): RenderedExternalEmail {
  const paragraphs = input.message
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const { html, text } = renderEmailLayout({
    locale: 'pt',
    title: input.subject,
    preheader: `Mensagem de ${input.sender.name} via Guigui.com`,
    sections: paragraphs.map((paragraph) => ({ type: 'paragraph' as const, text: paragraph })),
    closing: `— ${input.sender.name}`,
    appUrl: input.appUrl,
    footer: {
      reason:
        `Esta mensagem foi enviada por ${input.sender.name} através do Guigui.com. ` +
        `Responda a este email para falar directamente com ${input.sender.name}.`,
    },
  });

  return { subject: input.subject, html, text };
}

export interface ExternalEmailComposition {
  dispatcher: EmailDispatcher;
  appUrl?: string;
}

export interface CreateExternalEmailSenderOptions {
  env?: NodeJS.ProcessEnv;
  repository?: EmailDeliveryRepository;
  /** Substituível em testes para não contactar fornecedores reais. */
  compose?: () => ExternalEmailComposition;
}

export interface ExternalEmailSenderPort {
  send(input: ExternalEmailInput): Promise<EmailDispatchOutcome>;
}

export function createExternalEmailSender(
  options: CreateExternalEmailSenderOptions = {},
): ExternalEmailSenderPort {
  let composition: ExternalEmailComposition | undefined;

  // Uma composição bem-sucedida é reutilizada: não se cria um transporte novo
  // por email. A falha de configuração não fica memorizada — resolver o
  // ambiente é barato e um ambiente corrigido (chave ou SMTP adicionados) volta
  // a funcionar sem reiniciar o processo.
  function resolveComposition(): ExternalEmailComposition {
    if (composition) return composition;
    const compose =
      options.compose ??
      (() => {
        const configured = createConfiguredEmailDispatcher({
          repository: options.repository,
          env: options.env,
        });
        return { dispatcher: configured.dispatcher, appUrl: configured.config.appUrl };
      });
    composition = compose();
    return composition;
  }

  return {
    async send(input: ExternalEmailInput): Promise<EmailDispatchOutcome> {
      const subject = normaliseSubject(input.subject);
      if (!subject) {
        throw new ExternalEmailValidationError('subject_missing', 'O assunto é obrigatório.');
      }
      if (subject.length > EXTERNAL_EMAIL_MAX_SUBJECT) {
        throw new ExternalEmailValidationError(
          'subject_too_long',
          `O assunto não pode exceder ${EXTERNAL_EMAIL_MAX_SUBJECT} caracteres.`,
        );
      }

      const message = normaliseMessage(input.message);
      if (!message) {
        throw new ExternalEmailValidationError('message_missing', 'A mensagem é obrigatória.');
      }
      if (message.length > EXTERNAL_EMAIL_MAX_MESSAGE) {
        throw new ExternalEmailValidationError(
          'message_too_long',
          `A mensagem não pode exceder ${EXTERNAL_EMAIL_MAX_MESSAGE} caracteres.`,
        );
      }

      const recipient = normaliseEmailAddress(input.to);
      if (!recipient.ok || !recipient.value) {
        throw new ExternalEmailValidationError(
          'recipient_invalid',
          'O destinatário não é um endereço de email válido.',
        );
      }
      if (recipient.value.email.toLowerCase() === input.sender.email.trim().toLowerCase()) {
        throw new ExternalEmailValidationError(
          'recipient_is_sender',
          'Escolha um destinatário diferente da sua própria conta.',
        );
      }

      const active = resolveComposition();
      const rendered = renderExternalEmail({
        sender: input.sender,
        subject,
        message,
        appUrl: active.appUrl,
      });

      return active.dispatcher.dispatch({
        to: recipient.value,
        kind: 'external_message',
        locale: 'pt',
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: {
          email: input.sender.email.trim(),
          name: input.sender.name.trim() || undefined,
        },
        ...(input.requestId
          ? { dedupeKey: `external:${input.sender.userId}:${input.requestId.trim().slice(0, 120)}` }
          : {}),
        relatedUserId: input.sender.userId,
      });
    },
  };
}
