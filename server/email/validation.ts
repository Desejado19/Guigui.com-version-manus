import { normaliseAndValidateEmail } from '../../shared/emailAddress';
import type { EmailAddress, EmailContent } from './types';

/**
 * Validação de entrada de email.
 *
 * Corre antes de qualquer chamada ao fornecedor e antes de escrever no
 * repositório: evita injecção de cabeçalhos (CR/LF), listas de destinatários,
 * endereços inválidos e mensagens acima dos limites das APIs.
 */

export const MAX_RECIPIENT_LENGTH = 254;
export const MAX_DISPLAY_NAME_LENGTH = 120;
export const MAX_SUBJECT_LENGTH = 200;
export const MAX_HTML_BYTES = 512 * 1024;
export const MAX_TEXT_BYTES = 200 * 1024;
export const MAX_ATTACHMENTS_BYTES = 6 * 1024 * 1024;
export const MAX_ATTACHMENT_FILENAME_LENGTH = 120;

const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const LOCAL_DOMAIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
// Sem flag global: `.test()` com /g é stateful e falharia a cada segunda chamada.
const CONTROL_CHARACTERS_TEST = /[\u0000-\u001f\u007f]/;

export interface EmailValidationResult<T> {
  ok: boolean;
  value?: T;
  code?: string;
  message?: string;
}

function fail(code: string, message: string): EmailValidationResult<never> {
  return { ok: false, code, message };
}

/** Limpa um nome de exibição: sem CR/LF, sem caracteres de controlo. */
export function sanitiseDisplayName(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

function splitAddress(input: EmailAddress | string): { email: string; name?: string } {
  if (typeof input !== 'string') {
    return { email: typeof input.email === 'string' ? input.email : '', name: input.name };
  }
  const bracketed = input.match(/^\s*(.*?)\s*<\s*([^<>]+)\s*>\s*$/);
  if (bracketed) {
    return { email: bracketed[2], name: bracketed[1] || undefined };
  }
  return { email: input };
}

/**
 * Normaliza e valida um destinatário.
 *
 * `allowLocalDomain` existe apenas para desenvolvimento/Mailpit (`user@localhost`);
 * em produção a configuração nunca o activa.
 */
export function normaliseEmailAddress(
  input: EmailAddress | string,
  options: { allowLocalDomain?: boolean } = {},
): EmailValidationResult<EmailAddress> {
  const { email: rawEmail, name } = splitAddress(input);
  const trimmed = String(rawEmail ?? '').trim();

  if (!trimmed) return fail('recipient_missing', 'O destinatário do email não foi indicado.');
  if (trimmed.length > MAX_RECIPIENT_LENGTH) {
    return fail('recipient_too_long', 'O endereço do destinatário excede o limite de 254 caracteres.');
  }
  if (CONTROL_CHARACTERS_TEST.test(trimmed)) {
    return fail('recipient_invalid', 'O endereço do destinatário contém caracteres inválidos.');
  }
  if (/[\s,;]/.test(trimmed)) {
    return fail(
      'recipient_invalid',
      'O destinatário deve ser um único endereço de email, sem listas nem espaços.',
    );
  }

  // Regra única do projecto: o domínio é normalizado para minúsculas e a
  // validação rejeita espaços, listas, pontos incoerentes e TLDs numéricos.
  const validated = normaliseAndValidateEmail(trimmed);
  if (validated.ok && (validated.email.split('@')[1] || '').includes('.')) {
    return {
      ok: true,
      value: { email: validated.email, name: sanitiseDisplayName(name) },
    };
  }

  // Excepção restrita a desenvolvimento/Mailpit: `user@localhost`.
  if (options.allowLocalDomain) {
    const atIndex = trimmed.lastIndexOf('@');
    const localPart = atIndex > 0 ? trimmed.slice(0, atIndex) : '';
    const rawDomain = atIndex > 0 ? trimmed.slice(atIndex + 1).toLowerCase() : '';
    const localAllowed = Boolean(localPart)
      && !rawDomain.includes('.')
      && LOCAL_DOMAIN_PATTERN.test(rawDomain)
      && !localPart.startsWith('.')
      && !localPart.endsWith('.')
      && !localPart.includes('..')
      && EMAIL_PATTERN.test(`${localPart}@example.com`);
    if (localAllowed) {
      return {
        ok: true,
        value: { email: `${localPart}@${rawDomain}`, name: sanitiseDisplayName(name) },
      };
    }
  }

  return fail('recipient_invalid', 'O endereço do destinatário não é válido.');
}

/** Etiqueta segura para registar um destinatário recusado sem perder o valor bruto. */
export function describeRecipient(input: EmailAddress | string): string {
  const raw = typeof input === 'string' ? input : input?.email;
  return String(raw ?? '')
    .replace(CONTROL_CHARACTERS, ' ')
    .trim()
    .slice(0, MAX_RECIPIENT_LENGTH) || '(sem destinatário)';
}

/** Formato `Nome <email>` aceite por Nodemailer/SMTP. */
export function formatEmailAddress(address: EmailAddress): string {
  const name = sanitiseDisplayName(address.name);
  return name ? `${name} <${address.email}>` : address.email;
}

function sanitiseSubject(value: string): string {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SUBJECT_LENGTH);
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

/**
 * Valida assunto, corpo e anexos.
 *
 * O assunto é limpo de CR/LF em vez de recusado: um template que introduza uma
 * quebra de linha não pode transformar-se em injecção de cabeçalhos.
 */
export function validateEmailContent(content: EmailContent): EmailValidationResult<EmailContent> {
  const subject = sanitiseSubject(content.subject);
  if (!subject) {
    return fail('subject_missing', 'O assunto do email está vazio.');
  }

  const html = String(content.html ?? '');
  const text = String(content.text ?? '');
  if (!html.trim()) return fail('html_missing', 'O corpo HTML do email está vazio.');
  if (!text.trim()) return fail('text_missing', 'A versão em texto simples do email está vazia.');
  if (byteLength(html) > MAX_HTML_BYTES) {
    return fail('html_too_large', 'O corpo HTML do email excede o limite permitido.');
  }
  if (byteLength(text) > MAX_TEXT_BYTES) {
    return fail('text_too_large', 'A versão em texto do email excede o limite permitido.');
  }

  const attachments = content.attachments ?? [];
  let attachmentBytes = 0;
  const normalisedAttachments = [];
  for (const attachment of attachments) {
    const filename = String(attachment.filename ?? '')
      .replace(CONTROL_CHARACTERS, '')
      .replace(/[\\/]/g, '-')
      .trim()
      .slice(0, MAX_ATTACHMENT_FILENAME_LENGTH);
    if (!filename) {
      return fail('attachment_filename_missing', 'Um anexo do email não tem nome de ficheiro.');
    }
    if (!Buffer.isBuffer(attachment.content) || attachment.content.length === 0) {
      return fail('attachment_empty', `O anexo ${filename} está vazio.`);
    }
    attachmentBytes += attachment.content.length;
    if (attachmentBytes > MAX_ATTACHMENTS_BYTES) {
      return fail('attachments_too_large', 'Os anexos do email excedem o limite permitido.');
    }
    normalisedAttachments.push({ ...attachment, filename });
  }

  return {
    ok: true,
    value: {
      subject,
      html,
      text,
      attachments: normalisedAttachments,
    },
  };
}
