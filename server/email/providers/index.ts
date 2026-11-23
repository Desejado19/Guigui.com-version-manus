import type { EmailConfig } from '../config';
import { EmailConfigurationError, type EmailProvider } from '../types';
import { createBrevoEmailProvider } from './brevo';
import { createSmtpEmailProvider } from './smtp';

export { createBrevoEmailProvider } from './brevo';
export { createSmtpEmailProvider } from './smtp';

/**
 * Cria o adapter configurado. Falha explicitamente em vez de cair para um modo
 * simulado: um email transaccional em falta tem de ser visível, não silencioso.
 */
export function createEmailProvider(config: EmailConfig): EmailProvider {
  if (config.provider === 'brevo') {
    if (!config.brevo?.apiKey) {
      throw new EmailConfigurationError('A API da Brevo não está configurada.', [
        'Defina BREVO_API_KEY no ambiente do servidor.',
      ]);
    }
    return createBrevoEmailProvider({
      apiKey: config.brevo.apiKey,
      mode: config.mode,
    });
  }

  if (!config.smtp?.host) {
    throw new EmailConfigurationError('O servidor SMTP não está configurado.', [
      'Defina SMTP_HOST (e SMTP_USER/SMTP_PASSWORD quando o relay exigir autenticação).',
    ]);
  }
  return createSmtpEmailProvider({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    user: config.smtp.user,
    password: config.smtp.password,
    mode: config.mode,
  });
}
