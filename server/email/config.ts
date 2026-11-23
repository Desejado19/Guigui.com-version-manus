import type { EmailAddress, EmailProviderMode, EmailProviderName } from './types';
import { normaliseEmailAddress } from './validation';

/**
 * Configuração do envio de email, resolvida apenas a partir do ambiente.
 *
 * Não existe detecção implícita de servidor: só há envio real quando o
 * fornecedor está explicitamente configurado (`BREVO_API_KEY` ou `SMTP_HOST`).
 * Em desenvolvimento isso significa apontar `SMTP_HOST` para o Mailpit; sem
 * nada definido, os fluxos ficam em modo simulado e devolvem o link manual.
 * Nunca há credenciais por omissão.
 */

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_SMTP_PORT = 587;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export interface EmailConfig {
  provider: EmailProviderName;
  mode: EmailProviderMode;
  from: EmailAddress;
  replyTo?: EmailAddress;
  appUrl: string;
  maxAttempts: number;
  retryBaseDelayMs: number;
  brevo?: { apiKey: string };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
  };
  /** Verdadeiro quando o SMTP é uma caixa local (Mailpit): nada sai da máquina. */
  localMailbox: boolean;
  warnings: string[];
}

export interface EmailConfigResolution {
  ready: boolean;
  config?: EmailConfig;
  reason?: string;
  issues: string[];
}

function readPositiveInteger(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function resolveEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfigResolution {
  const isProduction = (env.NODE_ENV || 'development').trim() === 'production';
  const requested = (env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const issues: string[] = [];
  const warnings: string[] = [];

  if (requested && !['brevo', 'smtp', 'none', 'auto'].includes(requested)) {
    return {
      ready: false,
      reason: `EMAIL_PROVIDER tem um valor desconhecido: "${requested}".`,
      issues: ['Use EMAIL_PROVIDER=brevo, EMAIL_PROVIDER=smtp ou EMAIL_PROVIDER=none.'],
    };
  }
  if (requested === 'none') {
    return {
      ready: false,
      reason: 'O envio de email está desligado (EMAIL_PROVIDER=none).',
      issues: ['Defina EMAIL_PROVIDER=brevo ou EMAIL_PROVIDER=smtp para enviar email.'],
    };
  }

  const brevoApiKey = env.BREVO_API_KEY?.trim();
  const smtpHost = env.SMTP_HOST?.trim();
  let provider: EmailProviderName | null = null;
  if (requested === 'brevo' || requested === 'smtp') {
    provider = requested;
  } else if (brevoApiKey) {
    provider = 'brevo';
  } else if (smtpHost) {
    provider = 'smtp';
  }

  if (!provider) {
    return {
      ready: false,
      reason: 'Nenhum fornecedor de email real está configurado.',
      issues: [
        isProduction
          ? 'Produção exige EMAIL_PROVIDER=brevo com BREVO_API_KEY, ou EMAIL_PROVIDER=smtp com SMTP_HOST.'
          : 'Defina BREVO_API_KEY ou SMTP_HOST; sem isso os fluxos ficam em modo simulado.',
      ],
    };
  }

  const configuredFrom = env.EMAIL_FROM?.trim();
  let from: EmailAddress | null = null;
  if (configuredFrom) {
    const parsed = normaliseEmailAddress(configuredFrom, { allowLocalDomain: !isProduction });
    if (parsed.ok && parsed.value) {
      from = {
        email: parsed.value.email,
        name: parsed.value.name || env.EMAIL_FROM_NAME?.trim() || 'Guigui.com',
      };
    } else {
      issues.push('EMAIL_FROM não contém um endereço de email válido.');
    }
  } else if (!isProduction) {
    from = { email: 'no-reply@guigui.local', name: env.EMAIL_FROM_NAME?.trim() || 'Guigui.com' };
    warnings.push('EMAIL_FROM não está definido; em desenvolvimento usa-se no-reply@guigui.local.');
  } else {
    issues.push('EMAIL_FROM é obrigatório em produção (ex.: "Guigui.com <no-reply@guigui.com>").');
  }

  let replyTo: EmailAddress | undefined;
  const configuredReplyTo = env.EMAIL_REPLY_TO?.trim();
  if (configuredReplyTo) {
    const parsed = normaliseEmailAddress(configuredReplyTo, { allowLocalDomain: !isProduction });
    if (parsed.ok && parsed.value) replyTo = parsed.value;
    else issues.push('EMAIL_REPLY_TO não contém um endereço de email válido.');
  }

  let brevo: EmailConfig['brevo'];
  if (provider === 'brevo') {
    if (!brevoApiKey) issues.push('BREVO_API_KEY é obrigatória quando EMAIL_PROVIDER=brevo.');
    brevo = { apiKey: brevoApiKey || '' };
  }

  let smtp: EmailConfig['smtp'];
  let localMailbox = false;
  if (provider === 'smtp') {
    if (!smtpHost) {
      issues.push('SMTP_HOST é obrigatório quando EMAIL_PROVIDER=smtp.');
    }
    const user = env.SMTP_USER?.trim() || undefined;
    const password = env.SMTP_PASSWORD;
    if (user && !password) issues.push('SMTP_USER está definido sem SMTP_PASSWORD.');

    const port = Number(env.SMTP_PORT?.trim() || DEFAULT_SMTP_PORT);
    if (!Number.isFinite(port) || port <= 0) issues.push('SMTP_PORT não é uma porta válida.');

    localMailbox = Boolean(smtpHost && (LOCAL_HOSTS.has(smtpHost) || port === 1025));
    smtp = {
      host: smtpHost || '',
      port: Number.isFinite(port) && port > 0 ? port : DEFAULT_SMTP_PORT,
      secure: env.SMTP_SECURE === 'true',
      user,
      password,
    };
    if (localMailbox) {
      warnings.push(
        'SMTP aponta para uma caixa local de desenvolvimento; estas mensagens não saem para a Internet.',
      );
    }
  }

  if (issues.length > 0 || !from) {
    return {
      ready: false,
      reason: 'A configuração de email está incompleta.',
      issues,
    };
  }

  return {
    ready: true,
    issues: [],
    config: {
      provider,
      mode: isProduction ? 'live' : 'development',
      from,
      replyTo,
      appUrl: (env.APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, ''),
      maxAttempts: readPositiveInteger(env.EMAIL_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 5),
      retryBaseDelayMs: readPositiveInteger(
        env.EMAIL_RETRY_BASE_DELAY_MS,
        DEFAULT_RETRY_BASE_DELAY_MS,
        30_000,
      ),
      brevo,
      smtp,
      localMailbox,
      warnings,
    },
  };
}
