import { renderEmailLayout } from '../layout';
import type { EmailAttachment } from '../types';

/**
 * Email de recuperação de palavra-passe.
 *
 * O token é mostrado como código para ser colado na aplicação. Não é colocado
 * no URL: links com tokens ficam em históricos, proxies e cabeçalhos Referer.
 */

export interface PasswordResetEmailData {
  recipientName: string;
  token: string;
  expiresInMinutes?: number;
  appUrl?: string;
}

export interface RenderedPasswordResetEmail {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

export function renderPasswordResetEmail(
  input: PasswordResetEmailData,
): RenderedPasswordResetEmail {
  const minutes = Math.max(1, Math.round(input.expiresInMinutes ?? 15));
  const { html, text } = renderEmailLayout({
    locale: 'pt',
    title: 'Recuperar a palavra-passe',
    preheader: 'Use o código abaixo para definir uma nova palavra-passe.',
    greeting: `Olá, ${input.recipientName}!`,
    intro: 'Recebemos um pedido para recuperar a palavra-passe da sua conta Guigui.com.',
    sections: [
      {
        type: 'panel',
        title: 'Código de recuperação',
        rows: [{ label: 'Código', value: input.token }],
      },
      {
        type: 'callout',
        text: `Este código expira em ${minutes} minutos e só pode ser usado uma vez.`,
        tone: 'warning',
      },
    ],
    ...(input.appUrl ? { action: { label: 'Abrir Guigui.com', url: input.appUrl } } : {}),
    closing: 'Se não pediu esta alteração, ignore este email: a palavra-passe actual continua válida.',
    appUrl: input.appUrl,
    footer: {
      reason: 'Recebeu este email porque foi pedida a recuperação de uma conta Guigui.com.',
    },
  });

  return {
    subject: 'Código para recuperar a palavra-passe — Guigui.com',
    html,
    text,
    attachments: [],
  };
}
