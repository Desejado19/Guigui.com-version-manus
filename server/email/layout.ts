import type { EmailLocale } from './types';

/**
 * Layout único dos emails transaccionais do Guigui.com.
 *
 * Características obrigatórias:
 * - tabelas com estilos inline, para Outlook/Windows e clientes móveis;
 * - largura fluida até 600px, com media query para ecrãs pequenos;
 * - botão com área de toque confortável e `bgcolor` para Outlook;
 * - versão em texto simples construída a partir das mesmas secções;
 * - todo o texto é escapado e só links http(s)/mailto são aceites.
 */

export type EmailSection =
  | { type: 'paragraph'; text: string }
  | { type: 'panel'; title?: string; rows: Array<{ label: string; value: string }> }
  | { type: 'list'; title?: string; items: string[] }
  | { type: 'callout'; text: string; tone?: 'info' | 'warning' | 'success' }
  /** HTML já produzido por um template interno de confiança (nunca por input do utilizador). */
  | { type: 'html'; html: string };

export interface EmailLayoutInput {
  locale: EmailLocale;
  title: string;
  preheader?: string;
  greeting?: string;
  intro?: string;
  sections?: EmailSection[];
  action?: { label: string; url: string };
  secondaryAction?: { label: string; url: string };
  closing?: string;
  appUrl?: string;
  footer?: {
    reason?: string;
    legalName?: string;
    legalAddress?: string;
    helpUrl?: string;
    preferencesUrl?: string;
    unsubscribeUrl?: string;
  };
}

export interface RenderedEmailLayout {
  html: string;
  text: string;
}

const BRAND = '#08794f';
const BRAND_DARK = '#065f46';
const INK = '#102922';
const MUTED = '#526b62';
const BORDER = '#d7e6df';
const CANVAS = '#f2f6f4';

const LOCALE_STRINGS: Record<
  EmailLocale,
  {
    htmlLang: string;
    tagline: string;
    help: string;
    preferences: string;
    unsubscribe: string;
    defaultReason: string;
    automatic: string;
  }
> = {
  pt: {
    htmlLang: 'pt',
    tagline: 'O marketplace da Guiné-Bissau',
    help: 'Precisa de ajuda?',
    preferences: 'Preferências de email',
    unsubscribe: 'Cancelar subscrição',
    defaultReason: 'Recebeu este email porque tem uma conta no Guigui.com.',
    automatic: 'Esta mensagem foi enviada automaticamente; não responda a este endereço.',
  },
  fr: {
    htmlLang: 'fr',
    tagline: 'La place de marché de la Guinée-Bissau',
    help: "Besoin d'aide ?",
    preferences: "Préférences d'e-mail",
    unsubscribe: 'Se désabonner',
    defaultReason: 'Vous recevez cet e-mail car vous avez un compte sur Guigui.com.',
    automatic: "Ce message a été envoyé automatiquement ; n'y répondez pas.",
  },
  en: {
    htmlLang: 'en',
    tagline: 'The marketplace of Guinea-Bissau',
    help: 'Need help?',
    preferences: 'Email preferences',
    unsubscribe: 'Unsubscribe',
    defaultReason: 'You received this email because you have a Guigui.com account.',
    automatic: 'This message was sent automatically; please do not reply to this address.',
  },
  es: {
    htmlLang: 'es',
    tagline: 'El marketplace de Guinea-Bisáu',
    help: '¿Necesitas ayuda?',
    preferences: 'Preferencias de correo',
    unsubscribe: 'Cancelar suscripción',
    defaultReason: 'Recibiste este correo porque tienes una cuenta en Guigui.com.',
    automatic: 'Este mensaje se envió automáticamente; no respondas a esta dirección.',
  },
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      (
        {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        } as Record<string, string>
      )[character]!,
  );
}

function safeUrl(value: string): string {
  const trimmed = String(value ?? '').trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : '#';
}

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function renderSectionHtml(section: EmailSection): string {
  switch (section.type) {
    case 'paragraph':
      return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${INK}">${escapeHtml(
        section.text,
      )}</p>`;
    case 'panel': {
      const rows = section.rows
        .map(
          (row) =>
            `<tr>` +
            `<td style="padding:8px 0;font-family:${FONT_STACK};font-size:13px;line-height:1.4;color:${MUTED};vertical-align:top;width:44%">${escapeHtml(
              row.label,
            )}</td>` +
            `<td style="padding:8px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.4;color:${INK};font-weight:600;vertical-align:top">${escapeHtml(
              row.value,
            )}</td>` +
            `</tr>`,
        )
        .join('');
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:#f7fbf9;border:1px solid ${BORDER};border-radius:12px">` +
        `<tr><td style="padding:12px 18px">` +
        (section.title
          ? `<p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED}">${escapeHtml(
              section.title,
            )}</p>`
          : '') +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>` +
        `</td></tr></table>`
      );
    }
    case 'list': {
      const items = section.items
        .map(
          (item) =>
            `<li style="margin:0 0 8px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${INK}">${escapeHtml(
              item,
            )}</li>`,
        )
        .join('');
      return (
        (section.title
          ? `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:15px;font-weight:700;color:${INK}">${escapeHtml(
              section.title,
            )}</p>`
          : '') +
        `<ul style="margin:0 0 20px;padding-left:22px">${items}</ul>`
      );
    }
    case 'callout': {
      const tone = section.tone ?? 'info';
      const palette =
        tone === 'warning'
          ? { background: '#fff7ed', border: '#fdba74', text: '#9a3412' }
          : tone === 'success'
            ? { background: '#ecfdf5', border: '#6ee7b7', text: '#065f46' }
            : { background: '#eff6ff', border: '#93c5fd', text: '#1e3a8a' };
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:${palette.background};border-left:4px solid ${palette.border};border-radius:8px">` +
        `<tr><td style="padding:14px 16px;font-family:${FONT_STACK};font-size:14px;line-height:1.55;color:${palette.text}">${escapeHtml(
          section.text,
        )}</td></tr></table>`
      );
    }
    case 'html':
      return `<div style="margin:0 0 20px">${section.html}</div>`;
    default:
      return '';
  }
}

function renderSectionText(section: EmailSection): string {
  switch (section.type) {
    case 'paragraph':
      return section.text;
    case 'panel':
      return [section.title, ...section.rows.map((row) => `${row.label}: ${row.value}`)]
        .filter(Boolean)
        .join('\n');
    case 'list':
      return [section.title, ...section.items.map((item) => `- ${item}`)]
        .filter(Boolean)
        .join('\n');
    case 'callout':
      return section.text;
    case 'html':
      return '';
    default:
      return '';
  }
}

function renderButton(label: string, url: string, variant: 'primary' | 'secondary'): string {
  const background = variant === 'primary' ? BRAND : '#ffffff';
  const color = variant === 'primary' ? '#ffffff' : BRAND_DARK;
  const border = variant === 'primary' ? BRAND : BORDER;
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px">` +
    `<tr><td align="center" bgcolor="${background}" style="border:1px solid ${border};border-radius:10px">` +
    `<a class="gg-button" href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer" ` +
    `style="display:inline-block;padding:14px 28px;font-family:${FONT_STACK};font-size:16px;font-weight:700;line-height:1.2;color:${color};text-decoration:none;border-radius:10px">${escapeHtml(
      label,
    )}</a>` +
    `</td></tr></table>`
  );
}

export function renderEmailLayout(input: EmailLayoutInput): RenderedEmailLayout {
  const strings = LOCALE_STRINGS[input.locale] ?? LOCALE_STRINGS.pt;
  const appUrl = (input.appUrl || 'https://guigui.com').replace(/\/+$/, '');
  const sections = input.sections ?? [];
  const footer = input.footer ?? {};
  const year = new Date().getFullYear();

  const bodyHtml = [
    input.greeting
      ? `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:17px;font-weight:700;line-height:1.5;color:${INK}">${escapeHtml(
          input.greeting,
        )}</p>`
      : '',
    input.intro
      ? `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${INK}">${escapeHtml(
          input.intro,
        )}</p>`
      : '',
    ...sections.map(renderSectionHtml),
    input.action ? renderButton(input.action.label, input.action.url, 'primary') : '',
    input.secondaryAction
      ? renderButton(input.secondaryAction.label, input.secondaryAction.url, 'secondary')
      : '',
    input.closing
      ? `<p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${MUTED}">${escapeHtml(
          input.closing,
        )}</p>`
      : '',
  ].join('');

  const footerLinks = [
    footer.helpUrl
      ? `<a href="${escapeHtml(safeUrl(footer.helpUrl))}" style="color:${BRAND_DARK};text-decoration:underline">${escapeHtml(
          strings.help,
        )}</a>`
      : '',
    footer.preferencesUrl
      ? `<a href="${escapeHtml(safeUrl(footer.preferencesUrl))}" style="color:${BRAND_DARK};text-decoration:underline">${escapeHtml(
          strings.preferences,
        )}</a>`
      : '',
    footer.unsubscribeUrl
      ? `<a href="${escapeHtml(safeUrl(footer.unsubscribeUrl))}" style="color:${BRAND_DARK};text-decoration:underline">${escapeHtml(
          strings.unsubscribe,
        )}</a>`
      : '',
  ]
    .filter(Boolean)
    .join(' &nbsp;·&nbsp; ');

  const legal = [footer.legalName, footer.legalAddress].filter(Boolean).join(' · ');

  const html =
    `<!DOCTYPE html>` +
    `<html lang="${strings.htmlLang}" dir="ltr">` +
    `<head>` +
    `<meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width,initial-scale=1" />` +
    `<meta name="x-apple-disable-message-reformatting" />` +
    `<meta name="color-scheme" content="light dark" />` +
    `<meta name="supported-color-schemes" content="light dark" />` +
    `<title>${escapeHtml(input.title)}</title>` +
    `<style>` +
    `body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}` +
    `table{border-collapse:collapse!important;}` +
    `img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}` +
    `@media (max-width:600px){` +
    `.gg-container{width:100%!important;max-width:100%!important;}` +
    `.gg-pad{padding-left:20px!important;padding-right:20px!important;}` +
    `.gg-button{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important;}` +
    `.gg-title{font-size:22px!important;line-height:1.3!important;}` +
    `}` +
    `@media (prefers-color-scheme:dark){` +
    `.gg-canvas{background:#0b1512!important;}` +
    `.gg-card{background:#10201b!important;border-color:#1f3a31!important;}` +
    `.gg-body-text,.gg-body-text *{color:#e6f2ec!important;}` +
    `}` +
    `</style>` +
    `</head>` +
    `<body class="gg-canvas" style="margin:0;padding:0;background:${CANVAS};">` +
    (input.preheader
      ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(
          input.preheader,
        )}</div>`
      : '') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">` +
    `<tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" class="gg-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">` +
    // Cabeçalho
    `<tr><td class="gg-pad" style="background:${BRAND};border-radius:16px 16px 0 0;padding:22px 28px;">` +
    `<span style="font-family:${FONT_STACK};font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">Guigui.com</span>` +
    `<span style="display:block;margin-top:3px;font-family:${FONT_STACK};font-size:12px;color:#c9ded5;">${escapeHtml(
      strings.tagline,
    )}</span>` +
    `</td></tr>` +
    // Corpo
    `<tr><td class="gg-card gg-pad" style="background:#ffffff;border:1px solid ${BORDER};border-top:0;padding:28px;">` +
    `<h1 class="gg-title" style="margin:0 0 18px;font-family:${FONT_STACK};font-size:24px;line-height:1.3;font-weight:800;color:${INK};">${escapeHtml(
      input.title,
    )}</h1>` +
    `<div class="gg-body-text">${bodyHtml}</div>` +
    `</td></tr>` +
    // Rodapé
    `<tr><td class="gg-pad" style="background:#ffffff;border:1px solid ${BORDER};border-top:0;border-radius:0 0 16px 16px;padding:20px 28px 26px;">` +
    `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(
      footer.reason || strings.defaultReason,
    )}</p>` +
    (legal
      ? `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(
          legal,
        )}</p>`
      : '') +
    (footerLinks
      ? `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;line-height:1.8;">${footerLinks}</p>`
      : '') +
    `<p style="margin:0;font-family:${FONT_STACK};font-size:11px;line-height:1.6;color:#7d918a;">${escapeHtml(
      strings.automatic,
    )}<br /><a href="${escapeHtml(safeUrl(appUrl))}" style="color:${BRAND_DARK};text-decoration:none;">${escapeHtml(
      appUrl.replace(/^https?:\/\//, ''),
    )}</a> · © ${year} Guigui.com</p>` +
    `</td></tr>` +
    `</table>` +
    `</td></tr></table>` +
    `</body></html>`;

  const textLines = [
    'Guigui.com',
    strings.tagline,
    '',
    input.title,
    '',
    input.greeting || '',
    input.intro || '',
    ...sections.map(renderSectionText).filter(Boolean),
    input.action ? `${input.action.label}: ${safeUrl(input.action.url)}` : '',
    input.secondaryAction
      ? `${input.secondaryAction.label}: ${safeUrl(input.secondaryAction.url)}`
      : '',
    input.closing || '',
    '',
    footer.reason || strings.defaultReason,
    legal,
    footer.helpUrl ? `${strings.help} ${safeUrl(footer.helpUrl)}` : '',
    footer.preferencesUrl ? `${strings.preferences}: ${safeUrl(footer.preferencesUrl)}` : '',
    footer.unsubscribeUrl ? `${strings.unsubscribe}: ${safeUrl(footer.unsubscribeUrl)}` : '',
    strings.automatic,
    safeUrl(appUrl),
  ];

  const text = textLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { html, text };
}
