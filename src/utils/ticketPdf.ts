import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { toDataURL } from 'qrcode';

/**
 * PDF de um bilhete.
 *
 * Reaproveita `pdf-lib` + `qrcode`, que já são dependências da aplicação usadas
 * pelo comprovativo (TicketVoucher). O QR Code é exatamente o mesmo do bilhete
 * na base de dados — o download nunca gera um código novo.
 */
export interface TicketPdfInput {
  ticketCode: string;
  qrToken?: string;
  holderName?: string;
  buyerName?: string;
  buyerPhone?: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  ticketTypeName?: string;
  priceXOF?: number;
  status?: string;
  purchasedAt?: string;
  expiresAt?: string;
}

const STATUS_PT: Record<string, string> = {
  valid: 'Válido',
  pending: 'Pendente',
  used: 'Utilizado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function wrap(text: string): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 58) {
      lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; size: number; font: PDFFont; color?: RGB },
): number {
  const lines = wrap(text);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * (options.size + 4),
      size: options.size,
      font: options.font,
      color: options.color,
    });
  });
  return options.y - (lines.length - 1) * (options.size + 4);
}

export async function buildTicketPdf(ticket: TicketPdfInput): Promise<Uint8Array> {
  const payload = `GUI-TICKET:v1:${ticket.qrToken || ticket.ticketCode}:${ticket.ticketCode}`;
  const qrDataUrl = await toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 420,
    color: { dark: '#062b23', light: '#ffffff' },
  });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.05, 0.2, 0.18);
  const muted = rgb(0.35, 0.4, 0.42);
  const accent = rgb(0.09, 0.38, 0.34);

  // Cabeçalho
  page.drawRectangle({ x: 0, y: 762, width: 595, height: 80, color: rgb(0.96, 0.97, 0.95) });
  page.drawText('GUIGUI.COM', { x: 48, y: 800, size: 20, font: bold, color: ink });
  page.drawText('Bilhete digital · Bissau', { x: 48, y: 780, size: 10, font, color: muted });

  let cursor = 720;
  const title = ticket.eventTitle || 'Bilhete Guigui';
  cursor = drawWrapped(page, title, { x: 48, y: cursor, size: 18, font: bold, color: ink });

  page.drawText(ticket.ticketTypeName || 'Entrada geral', { x: 48, y: cursor - 22, size: 11, font, color: accent });
  cursor -= 52;

  const rows: Array<[string, string]> = [
    ['Titular', ticket.holderName || ticket.buyerName || 'Cliente Guigui'],
    ['Contacto', ticket.buyerPhone || '—'],
    ['Data', formatDate(ticket.eventDate)],
    ['Hora', ticket.eventTime || '—'],
    ['Local', ticket.eventLocation || '—'],
    ['Preço', typeof ticket.priceXOF === 'number' ? `${ticket.priceXOF.toLocaleString('pt-PT')} XOF` : '—'],
    ['Estado', STATUS_PT[ticket.status || 'valid'] || ticket.status || 'Válido'],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, { x: 48, y: cursor, size: 10, font: bold, color: muted });
    cursor = drawWrapped(page, value, { x: 150, y: cursor, size: 11, font, color: ink }) - 20;
  }

  // Códigos
  page.drawLine({ start: { x: 48, y: cursor + 4 }, end: { x: 547, y: cursor + 4 }, thickness: 0.8, color: rgb(0.85, 0.87, 0.85) });
  page.drawText('Código único', { x: 48, y: cursor - 14, size: 9, font: bold, color: muted });
  page.drawText(ticket.ticketCode, { x: 48, y: cursor - 32, size: 15, font: bold, color: ink });
  page.drawText('Identificador do bilhete', { x: 48, y: cursor - 56, size: 9, font: bold, color: muted });
  page.drawText(ticket.qrToken || ticket.ticketCode, { x: 48, y: cursor - 72, size: 9, font, color: muted });

  // QR Code original
  const qrBytes = Uint8Array.from(atob(qrDataUrl.split(',')[1]), (character) => character.charCodeAt(0));
  const qrImage = await pdf.embedPng(qrBytes);
  page.drawImage(qrImage, { x: 380, y: cursor - 178, width: 165, height: 165 });
  page.drawText('QR Code de entrada', { x: 405, y: cursor - 194, size: 8, font, color: muted });

  page.drawText('Este bilhete só pode ser utilizado uma vez. Apresente o QR Code na entrada.', {
    x: 48,
    y: 84,
    size: 9,
    font,
    color: muted,
  });
  page.drawText('Documento gerado pelo Guigui.com a partir do registo original.', {
    x: 48,
    y: 70,
    size: 8,
    font,
    color: muted,
  });

  return pdf.save();
}

/** Nome de ficheiro seguro e único por bilhete, para dentro do ZIP. */
export function ticketPdfFileName(ticket: TicketPdfInput, index: number): string {
  const base = (ticket.eventTitle || 'bilhete')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'bilhete';
  const code = ticket.ticketCode.replace(/[^a-zA-Z0-9-]/g, '');
  return `${String(index + 1).padStart(2, '0')}-${base}-${code}.pdf`;
}
