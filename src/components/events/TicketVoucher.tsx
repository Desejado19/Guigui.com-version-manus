import React, { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CheckCircle2, Download, FileText, QrCode, ShieldCheck } from 'lucide-react';
import type { Language } from '../../types';

interface VoucherTicket {
  ticketCode: string;
  qrToken?: string;
  pinCode?: string;
  buyerName?: string;
  buyerPhone?: string;
  expiresAt?: string;
  priceXOF: number;
  status?: string;
  eventTitle?: string;
  ticketTypeName?: string;
}

interface TicketVoucherProps {
  ticket: VoucherTicket;
  index: number;
  total: number;
  currentLang?: Language;
}

const STATUS_TEXT: Record<string, string> = {
  valid: 'Bilhete válido',
  used: 'Bilhete utilizado',
  redeemed: 'Bilhete utilizado',
  pending: 'Bilhete pendente',
  cancelled: 'Bilhete cancelado',
};

function formatValidUntil(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-PT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value: number, lang: Language): string {
  return `${value.toLocaleString(lang === 'pt' ? 'pt-PT' : lang)} XOF`;
}

/**
 * Comprovativo de levantamento do bilhete: QR Code, código único, PIN,
 * dados do cliente e validade. Sem informação de pagamento ou de entrega.
 */
export const TicketVoucher: React.FC<TicketVoucherProps> = ({
  ticket,
  index,
  total,
  currentLang = 'pt',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    const payload = `GUI-TICKET:v1:${ticket.qrToken || ticket.ticketCode}:${ticket.ticketCode}`;
    toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 420,
      color: { dark: '#062b23', light: '#ffffff' },
    })
      .then((url: string) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [ticket.qrToken, ticket.ticketCode]);

  const downloadFile = (filename: string, content: BlobPart, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTicket = () => {
    const details = [
      'GUIGUI.COM - BILHETE DIGITAL',
      `Evento: ${ticket.eventTitle || ''}`,
      `Bilhete: ${ticket.ticketTypeName || ''} (${index + 1}/${total})`,
      `Código único: ${ticket.ticketCode}`,
      `PIN de validação: ${ticket.pinCode || 'Não disponível'}`,
      `Identificador: ${ticket.qrToken || ticket.ticketCode}`,
      `Cliente: ${ticket.buyerName || ''}`,
      `Contacto: ${ticket.buyerPhone || ''}`,
      `Validade: ${formatValidUntil(ticket.expiresAt)}`,
      `Preço por bilhete: ${formatMoney(ticket.priceXOF, currentLang)}`,
      'Este bilhete só pode ser utilizado uma vez.',
    ].join('\n');
    downloadFile(`${ticket.ticketCode}-bilhete.txt`, details, 'text/plain;charset=utf-8');
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const binary = atob(qrDataUrl.split(',')[1]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    downloadFile(`${ticket.ticketCode}-qrcode.png`, bytes, 'image/png');
  };

  const handleDownloadPdf = async () => {
    if (!qrDataUrl) return;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(',')[1]), (character) => character.charCodeAt(0));
    const qrImage = await pdf.embedPng(qrBytes);
    page.drawText('GUIGUI.COM', { x: 48, y: 790, size: 22, font: boldFont, color: rgb(0.05, 0.2, 0.18) });
    page.drawText('Comprovativo e código de levantamento', { x: 48, y: 765, size: 12, font, color: rgb(0.25, 0.3, 0.35) });
    page.drawText(ticket.eventTitle || 'Bilhete Guigui', { x: 48, y: 710, size: 18, font: boldFont, maxWidth: 350 });
    if (ticket.ticketTypeName) {
      page.drawText(`${ticket.ticketTypeName} (${index + 1}/${total})`, { x: 48, y: 685, size: 12, font });
    }
    [
      `Cliente: ${ticket.buyerName || ''}`,
      `Contacto: ${ticket.buyerPhone || ''}`,
      `Código único: ${ticket.ticketCode}`,
      `PIN de validação: ${ticket.pinCode || 'Não disponível'}`,
      `Validade: ${formatValidUntil(ticket.expiresAt)}`,
      `Preço por bilhete: ${formatMoney(ticket.priceXOF, currentLang)}`,
    ].forEach((detail, rowIndex) => page.drawText(detail, { x: 48, y: 635 - rowIndex * 24, size: 11, font }));
    page.drawImage(qrImage, { x: 375, y: 470, width: 170, height: 170 });
    page.drawText('Este bilhete só pode ser utilizado uma vez.', { x: 48, y: 120, size: 11, font });
    const bytes = await pdf.save();
    downloadFile(`${ticket.ticketCode}-bilhete.pdf`, bytes, 'application/pdf');
  };

  const statusText = STATUS_TEXT[ticket.status || 'valid'] || 'Bilhete válido';

  return (
    <article className="guigui-voucher">
      <header className="guigui-voucher-top">
        <p className="guigui-voucher-kicker">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Comprovativo e código de levantamento
        </p>
        <h2 className="guigui-voucher-title">{ticket.eventTitle || 'Bilhete Guigui'}</h2>
        <div className="guigui-voucher-subline">
          <span className="guigui-voucher-subtitle">
            Bilhete {ticket.ticketTypeName || 'Entrada'} ({index + 1}/{total})
          </span>
          <span className="guigui-voucher-status">
            {ticket.status === 'cancelled' ? (
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            {statusText}
          </span>
        </div>
      </header>

      <div className="guigui-voucher-divider" aria-hidden="true" />

      <div className="guigui-voucher-body">
        <div className="guigui-voucher-qr">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR Code do bilhete ${ticket.ticketCode}`} />
          ) : (
            <span className="guigui-voucher-token">A gerar QR Code…</span>
          )}
        </div>
        <p className="guigui-voucher-token">{ticket.qrToken || ticket.ticketCode}</p>

        <div className="guigui-voucher-codes">
          <div className="guigui-voucher-code">
            <span>Código único</span>
            <strong>{ticket.ticketCode}</strong>
          </div>
          {ticket.pinCode && (
            <div className="guigui-voucher-code">
              <span>PIN de validação</span>
              <strong>{ticket.pinCode}</strong>
            </div>
          )}
        </div>

        <div className="guigui-voucher-details">
          <div className="guigui-voucher-row">
            <span>Cliente:</span>
            <strong>{ticket.buyerName || 'Cliente Guigui'}</strong>
          </div>
          <div className="guigui-voucher-row">
            <span>Contacto:</span>
            <strong>{ticket.buyerPhone || '—'}</strong>
          </div>
          <div className="guigui-voucher-row">
            <span>Validade:</span>
            <strong>{formatValidUntil(ticket.expiresAt)}</strong>
          </div>
          <div className="guigui-voucher-row is-price">
            <span>Preço por bilhete:</span>
            <strong>{formatMoney(ticket.priceXOF, currentLang)}</strong>
          </div>
        </div>

        <div className="guigui-voucher-buttons">
          <button type="button" onClick={handleDownloadTicket} title="Descarregar bilhete">
            <Download className="h-4 w-4" aria-hidden="true" />
            Bilhete
          </button>
          <button type="button" onClick={handleDownloadQr} disabled={!qrDataUrl} title="Descarregar QR Code">
            <QrCode className="h-4 w-4" aria-hidden="true" />
            QR Code
          </button>
          <button type="button" onClick={() => void handleDownloadPdf()} disabled={!qrDataUrl} title="Descarregar PDF">
            <FileText className="h-4 w-4" aria-hidden="true" />
            PDF
          </button>
        </div>

        <p className="guigui-voucher-note">
          Este bilhete só pode ser utilizado uma vez. Apresente o QR Code ou o código ao staff da
          porta para validar a sua entrada.
        </p>
      </div>
    </article>
  );
};

TicketVoucher.displayName = 'TicketVoucher';
