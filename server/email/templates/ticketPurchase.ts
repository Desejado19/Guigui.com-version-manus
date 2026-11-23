import { toBuffer } from 'qrcode';
import type { TicketForValidation } from '../../validationService';
import { renderEmailLayout, type EmailSection } from '../layout';
import type { EmailAttachment } from '../types';

/**
 * Email de bilhetes confirmados.
 *
 * O QR viaja como ficheiro anexo (`<código>-qr.png`), não como imagem embutida:
 * `cid:` não é suportado pela API da Brevo e deixaria uma imagem quebrada. O
 * código e o PIN continuam visíveis no corpo e no texto simples.
 */

export interface TicketPurchaseEmailData {
  recipientName: string;
  eventTitle: string;
  totalAmountXOF: number;
  tickets: TicketForValidation[];
  appUrl?: string;
}

export interface RenderedTicketPurchaseEmail {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

function formatXof(value: number): string {
  return `${value.toLocaleString('pt-PT')} XOF`;
}

function qrFilename(ticket: TicketForValidation, index: number): string {
  const base = String(ticket.ticketCode || `bilhete-${index + 1}`)
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .slice(0, 60);
  return `${base}-qr.png`;
}

export async function renderTicketPurchaseEmail(
  input: TicketPurchaseEmailData,
): Promise<RenderedTicketPurchaseEmail> {
  const safeEventTitle = input.eventTitle.replace(/[\r\n]+/g, ' ').trim();
  const total = formatXof(input.totalAmountXOF);

  const attachments: EmailAttachment[] = [];
  const ticketSections: EmailSection[] = [];

  for (const [index, ticket] of input.tickets.entries()) {
    const filename = qrFilename(ticket, index);
    const qr = await toBuffer(`GUI-TICKET:v1:${ticket.qrToken}:${ticket.ticketCode}`, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#102922', light: '#ffffff' },
    });
    attachments.push({
      filename,
      content: qr,
      contentType: 'image/png',
    });

    ticketSections.push({
      type: 'panel',
      title: `Bilhete ${index + 1} de ${input.tickets.length}`,
      rows: [
        { label: 'Evento', value: ticket.eventTitle || safeEventTitle },
        { label: 'Categoria', value: ticket.ticketTypeName || 'Entrada Geral' },
        { label: 'Titular', value: ticket.holderName || ticket.buyerName },
        { label: 'Código', value: ticket.ticketCode },
        { label: 'PIN', value: ticket.pinCode || 'N/D' },
        { label: 'Preço', value: formatXof(ticket.priceXOF) },
        { label: 'QR Code', value: `${filename} (em anexo)` },
      ],
    });
  }

  const { html, text } = renderEmailLayout({
    locale: 'pt',
    title: 'Os seus bilhetes estão prontos',
    preheader: `${input.tickets.length} bilhete(s) para ${safeEventTitle}`,
    greeting: `Olá, ${input.recipientName},`,
    intro: `A sua compra para ${safeEventTitle} foi confirmada.`,
    sections: [
      {
        type: 'panel',
        title: 'Resumo da compra',
        rows: [
          { label: 'Evento', value: safeEventTitle },
          { label: 'Bilhetes', value: String(input.tickets.length) },
          { label: 'Total pago', value: total },
        ],
      },
      ...ticketSections,
      {
        type: 'callout',
        tone: 'info',
        text: 'Apresente o QR Code (em anexo) ou o código do bilhete à entrada. Não partilhe o PIN com terceiros.',
      },
    ],
    appUrl: input.appUrl,
    footer: {
      reason: 'Recebeu este email porque concluiu uma compra no Guigui.com.',
    },
  });

  return {
    subject: `Bilhetes para ${safeEventTitle}`,
    html,
    text,
    attachments,
  };
}
