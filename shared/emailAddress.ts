/**
 * Regra única de validação de email do Guigui.com.
 *
 * Usada no servidor (registo de cidadão, empresa, admin/equipa, convites,
 * email externo, conteúdo institucional) e no browser (compositor de email).
 * Não faz I/O: garante formato, comprimento e coerência do domínio. A prova de
 * que a caixa existe é feita pelo Google (`email_verified`) ou, para contas
 * locais, pelo fluxo de verificação por email.
 */

export const MAX_EMAIL_LENGTH = 254;
export const MAX_EMAIL_LOCAL_PART_LENGTH = 64;

// Mesmo padrão do envio de email: local part sem espaços, um único "@" e um
// domínio com pelo menos um ponto, labels válidos e sem hífen nas pontas.
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export type EmailValidationFailureCode =
  | 'EMAIL_MISSING'
  | 'EMAIL_TOO_LONG'
  | 'EMAIL_INVALID'
  | 'EMAIL_DOMAIN_INVALID';

// Interface única (em vez de união discriminada) porque o tsconfig do projecto
// não activa `strictNullChecks`, o que impede o narrowing por `ok`.
export interface EmailValidation {
  ok: boolean;
  email?: string;
  code?: EmailValidationFailureCode;
  message?: string;
}

function fail(code: EmailValidationFailureCode, message: string): EmailValidation {
  return { ok: false, code, message };
}

/**
 * Normaliza (trim, domínio em minúsculas) e valida um endereço de email.
 * Nunca lança: devolve um resultado discriminado.
 */
export function normaliseAndValidateEmail(input: unknown): EmailValidation {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return fail('EMAIL_MISSING', 'Indique um endereço de email.');
  if (raw.length > MAX_EMAIL_LENGTH) {
    return fail('EMAIL_TOO_LONG', `O email não pode exceder ${MAX_EMAIL_LENGTH} caracteres.`);
  }
  if (CONTROL_CHARACTERS.test(raw) || /[\s,;]/.test(raw)) {
    return fail('EMAIL_INVALID', 'Indique um único endereço de email, sem espaços nem listas.');
  }

  const atIndex = raw.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === raw.length - 1) {
    return fail('EMAIL_INVALID', 'O endereço de email não é válido.');
  }

  const localPart = raw.slice(0, atIndex);
  const domain = raw.slice(atIndex + 1).toLowerCase();
  if (localPart.length > MAX_EMAIL_LOCAL_PART_LENGTH) {
    return fail('EMAIL_INVALID', 'O endereço de email não é válido.');
  }
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return fail('EMAIL_INVALID', 'O endereço de email não é válido.');
  }
  if (!EMAIL_PATTERN.test(`${localPart}@${domain}`)) {
    return fail('EMAIL_INVALID', 'O endereço de email não é válido.');
  }

  // Um TLD só com dígitos (ex.: utilizador@dominio.123) não é um domínio real.
  const tld = domain.split('.').pop() || '';
  if (!/[a-z]/.test(tld)) {
    return fail('EMAIL_DOMAIN_INVALID', 'O domínio do email não é válido.');
  }

  return { ok: true, email: `${localPart}@${domain}` };
}

/** Conveniência: normaliza para comparação/armazenamento em contas. */
export function normaliseEmailForAccount(input: unknown): EmailValidation {
  const result = normaliseAndValidateEmail(input);
  return result.ok && result.email
    ? { ok: true, email: result.email.toLowerCase() }
    : result;
}
