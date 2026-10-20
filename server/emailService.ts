import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';
import { toBuffer } from 'qrcode';
import type { TicketForValidation } from './validationService';

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;

function getEmailTransport() {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM?.trim() || smtpUser;
  if (transporter === undefined) {
    transporter = smtpHost && smtpUser && smtpPassword && emailFrom
      ? nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPassword },
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
        })
      : null;
  }
  return { transporter, emailFrom };
}

export class EmailServiceNotConfiguredError extends Error {
  constructor() {
    super('O envio de e-mail não está configurado.');
    this.name = 'EmailServiceNotConfiguredError';
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function formatXof(value: number): string {
  return `${value.toLocaleString('pt-PT')} XOF`;
}

export async function buildTicketPurchaseEmailMessage(input: {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  totalAmountXOF: number;
  tickets: TicketForValidation[];
}): Promise<SendMailOptions> {
  const attachments: NonNullable<SendMailOptions['attachments']> = [];
  const ticketContent = await Promise.all(input.tickets.map(async (ticket, index) => {
    const cid = `ticket-qr-${index + 1}`;
    const qr = await toBuffer(`GUI-TICKET:v1:${ticket.qrToken}:${ticket.ticketCode}`, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 360,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    attachments.push({
      filename: `${ticket.ticketCode}-qr.png`,
      content: qr,
      contentType: 'image/png',
      cid,
    });
    const holderName = ticket.holderName || ticket.buyerName;
    const ticketTitle = `Bilhete ${index + 1} de ${input.tickets.length}`;
    const amount = formatXof(ticket.priceXOF);
    const text = [
      ticketTitle,
      `Evento: ${ticket.eventTitle || input.eventTitle}`,
      `Categoria: ${ticket.ticketTypeName || 'Entrada Geral'}`,
      `Titular: ${holderName}`,
      `Código: ${ticket.ticketCode}`,
      `PIN: ${ticket.pinCode || 'N/D'}`,
      `Preço por bilhete: ${amount}`,
    ].join('\n');
    const html = `<article style="border:1px solid #c9ded5;border-radius:12px;padding:16px;margin:16px 0;color:#102922">` +
      `<h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(ticketTitle)}</h2>` +
      `<p><strong>Evento:</strong> ${escapeHtml(ticket.eventTitle || input.eventTitle)}</p>` +
      `<p><strong>Categoria:</strong> ${escapeHtml(ticket.ticketTypeName || 'Entrada Geral')}</p>` +
      `<p><strong>Titular:</strong> ${escapeHtml(holderName)}</p>` +
      `<p><strong>Código:</strong> <code>${escapeHtml(ticket.ticketCode)}</code></p>` +
      `<p><strong>PIN:</strong> <code>${escapeHtml(ticket.pinCode || 'N/D')}</code></p>` +
      `<p><strong>Preço por bilhete:</strong> ${escapeHtml(amount)}</p>` +
      `<img src="cid:${cid}" width="180" height="180" alt="QR Code do bilhete ${index + 1}" style="display:block;width:180px;height:180px" />` +
      `</article>`;
    return { text, html };
  }));
  const safeEventTitle = input.eventTitle.replace(/[\r\n]+/g, ' ').trim();
  const total = formatXof(input.totalAmountXOF);
  const text = [
    `Olá ${input.recipientName},`,
    `A sua compra para ${input.eventTitle} foi confirmada.`,
    `${input.tickets.length} bilhete(s) emitido(s). Total pago: ${total}.`,
    '',
    ...ticketContent.flatMap(({ text: ticketText }) => [ticketText, '']),
    'Apresente o QR Code ou o código do bilhete à entrada. Não partilhe o PIN com terceiros.',
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#102922">` +
    `<h1 style="color:#08794f">Guigui.com — bilhetes digitais</h1>` +
    `<p>Olá ${escapeHtml(input.recipientName)},</p>` +
    `<p>A sua compra para <strong>${escapeHtml(input.eventTitle)}</strong> foi confirmada.</p>` +
    `<p>${input.tickets.length} bilhete(s) emitido(s). <strong>Total pago: ${escapeHtml(total)}</strong></p>` +
    ticketContent.map(({ html: ticketHtml }) => ticketHtml).join('') +
    `<p>Apresente o QR Code ou o código do bilhete à entrada. Não partilhe o PIN com terceiros.</p></div>`;

  return {
    to: input.recipientEmail,
    subject: `Bilhetes para ${safeEventTitle}`,
    text,
    html,
    attachments,
  };
}

export async function sendTicketPurchaseEmail(input: {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  totalAmountXOF: number;
  tickets: TicketForValidation[];
}): Promise<void> {
  const { transporter, emailFrom } = getEmailTransport();
  if (!transporter || !emailFrom) throw new EmailServiceNotConfiguredError();
  const message = await buildTicketPurchaseEmailMessage(input);
  await transporter.sendMail({ from: emailFrom, ...message });
}

export async function sendTeamInvitation(input: {
  recipientEmail: string;
  recipientName: string;
  businessName: string;
  roleLabel: string;
  token: string;
}) {
  const { transporter, emailFrom } = getEmailTransport();
  if (!transporter || !emailFrom) {
    throw new EmailServiceNotConfiguredError();
  }

  const appUrl = process.env.APP_URL?.trim() || 'http://localhost:3000';
  const inviteUrl = `${appUrl}/?team_invite=${encodeURIComponent(input.token)}`;
  await transporter.sendMail({
    from: emailFrom,
    to: input.recipientEmail,
    subject: `Convite para colaborar com ${input.businessName}`,
    text: `Olá ${input.recipientName},\n\nFoi convidado para colaborar com ${input.businessName} como ${input.roleLabel}.\n\nAceite o convite: ${inviteUrl}\n\nSe não reconhece este convite, ignore este e-mail.`,
    html: `<p>Olá ${input.recipientName},</p><p>Foi convidado para colaborar com <strong>${input.businessName}</strong> como <strong>${input.roleLabel}</strong>.</p><p><a href="${inviteUrl}">Aceitar convite</a></p><p>Se não reconhece este convite, ignore este e-mail.</p>`,
  });
}
