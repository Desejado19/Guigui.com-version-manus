import React, { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { QrCode, CheckCircle2, ShieldCheck, Copy, Download, Sparkles } from 'lucide-react';
import type { Language } from '../types';
import { formatDateTime, formatNumber, getTranslation } from '../utils/i18n';

interface QRCodeDisplayProps {
  code: string;
  qrToken: string;
  title: string;
  subtitle?: string;
  buyerName: string;
  buyerPhone: string;
  amountXOF: number;
  amountLabel?: 'qrAmountPaid' | 'qrUnitPrice';
  pinCode?: string;
  validUntil?: string;
  status?: 'pending' | 'redeemed' | 'valid' | 'used' | 'cancelled';
  onCopyCode?: () => void;
  onDownload?: () => void;
  purchaseReceipt?: boolean;
  /** Idioma do utilizador. Sem este valor o bilhete sai sempre em português. */
  currentLang?: Language;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  code,
  qrToken,
  title,
  subtitle,
  buyerName,
  buyerPhone,
  amountXOF,
  amountLabel = 'qrAmountPaid',
  pinCode,
  validUntil,
  status = 'pending',
  onCopyCode,
  onDownload,
  purchaseReceipt = false,
  currentLang = 'pt',
}) => {
  const t = (key: string, variables?: Record<string, string | number>) =>
    getTranslation(currentLang, key, variables);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState('');
  const isRedeemed = status === 'redeemed' || status === 'used';
  const isCancelled = status === 'cancelled';

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl('');
    setQrError('');
    const qrPayload = `GUI-TICKET:v1:${qrToken}:${code}`;
    toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 360,
      color: { dark: '#0B3B37', light: '#ffffff' },
    }).then((url: string) => {
      if (!cancelled) setQrDataUrl(url);
    }).catch((error: unknown) => {
      if (!cancelled) {
        console.error('Falha ao gerar QR Code do bilhete', error);
        setQrError(t('qrGenerationFailed'));
      }
    });
    return () => { cancelled = true; };
  }, [qrToken, code]);

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

  const handleDownloadCode = () => {
    const details = [
      'GUIGUI.COM - BILHETE DIGITAL',
      `${t('qrTxtEvent')}: ${title}`,
      subtitle ? `${t('qrTxtTicket')}: ${subtitle}` : '',
      `${t('qrTxtPurchaseCode')}: ${code}`,
      `${t('qrPin')}: ${pinCode || t('qrNotAvailable')}`,
      `${t('qrIdentifier')}: ${qrToken}`,
      `${t('qrClient')}: ${buyerName}`,
      `${t('qrContact')}: ${buyerPhone}`,
      `${t(amountLabel)}: ${formatNumber(amountXOF, currentLang)} XOF`,
      validUntil ? `${t('qrValidUntil')}: ${formatDateTime(validUntil, currentLang)}` : '',
      t('qrTxtPresent'),
    ].filter(Boolean).join('\n');
    downloadFile(`${code}-bilhete.txt`, details, 'text/plain;charset=utf-8');
    onDownload?.();
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const base64 = qrDataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    downloadFile(`${code}-qrcode.png`, bytes, 'image/png');
    onDownload?.();
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
    page.drawText(t('qrPdfSubtitle'), { x: 48, y: 765, size: 12, font, color: rgb(0.25, 0.3, 0.35) });
    page.drawText(title, { x: 48, y: 710, size: 18, font: boldFont, maxWidth: 350 });
    if (subtitle) page.drawText(subtitle, { x: 48, y: 685, size: 12, font });
    [
      `${t('qrPdfBuyer')}: ${buyerName}`,
      `${t('qrContact')}: ${buyerPhone}`,
      `${t('qrPdfCode')}: ${code}`,
      `${t(amountLabel === 'qrUnitPrice' ? 'qrUnitPrice' : 'qrPdfValue')}: ${formatNumber(amountXOF, currentLang)} XOF`,
      validUntil ? `${t('qrPdfValidUntil')}: ${formatDateTime(validUntil, currentLang)}` : '',
    ].filter(Boolean).forEach((detail, index) => page.drawText(detail, { x: 48, y: 635 - index * 24, size: 11, font }));
    page.drawImage(qrImage, { x: 375, y: 470, width: 170, height: 170 });
    page.drawText(t('qrPdfPresent'), { x: 48, y: 120, size: 11, font });
    page.drawText(t('qrPdfFootnote'), { x: 48, y: 98, size: 9, font, color: rgb(0.35, 0.4, 0.45) });
    const bytes = await pdf.save();
    downloadFile(`${code}-bilhete.pdf`, bytes, 'application/pdf');
    onDownload?.();
  };

  return (
    <div className={`ticket-surface ticket-proof-card mx-auto w-full max-w-md overflow-hidden rounded-2xl border text-center shadow-md relative cursor-pointer ${purchaseReceipt ? 'ticket-receipt-purchase' : 'space-y-1.5 p-2.5'}`}
      onClick={() => alert('QR Code card clicked')}
    >
      <div className="ticket-proof-header space-y-1 rounded-xl p-2.5 text-left">
        <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t('qrHeader')}</span>
        </div>
        <h3 className="font-semibold text-sm text-white line-clamp-2">{title}</h3>
      </div>

      <div className="ticket-proof-summary flex items-center justify-between gap-2 text-left">
        {subtitle && <span className="ticket-proof-subtitle truncate text-xs font-medium">{subtitle}</span>}
        {isCancelled ? (
          <span className="ticket-proof-status ticket-proof-status-cancelled flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
            <span>{t('qrCancelled')}</span>
          </span>
        ) : isRedeemed ? (
          <span className="ticket-proof-status ticket-proof-status-redeemed flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('qrRedeemed')}</span>
          </span>
        ) : status === 'valid' ? (
          <span className="ticket-proof-status ticket-proof-status-valid flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('qrValid')}</span>
          </span>
        ) : (
          <span className="ticket-proof-status ticket-proof-status-pending flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t('qrPending')}</span>
          </span>
        )}
      </div>

      <div className="ticket-proof-qr mx-auto inline-block rounded-xl border p-1.5">
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-lg border bg-white dark:bg-slate-900 p-1">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={t('qrAltText', { code })} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {qrError || t('qrGenerating')}
            </div>
          )}
        </div>
        <div className="ticket-proof-qr-label mt-1 max-w-48 break-all font-mono text-[10px] tracking-wider">{t('qrIdentifier')}: {qrToken}</div>
      </div>

      <div className="ticket-proof-information space-y-2">
        <div className="ticket-proof-code space-y-1 rounded-xl border p-2">
          <span className="ticket-proof-label block text-[9px] font-bold uppercase tracking-wider">{t('qrCodeLabel')}</span>
          <div className="flex items-center justify-center gap-1.5">
            <span className="ticket-proof-code-value select-all font-mono text-lg font-semibold tracking-[0.18em]">{code}</span>
            {onCopyCode && (
              <button type="button" onClick={onCopyCode} className="p-1 bg-white dark:bg-slate-900 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition" title={t('qrCopyCode')} aria-label={t('qrCopyCode')}>
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {pinCode && (
          <div className="ticket-proof-pin rounded-xl border px-2 py-1.5 text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="ticket-proof-label text-[9px] font-bold uppercase tracking-wider">{t('qrPin')}</span>
              <span className="ticket-proof-pin-value font-mono text-base font-semibold tracking-widest">{pinCode}</span>
            </div>
          </div>
        )}

        <div className="ticket-proof-details space-y-1 rounded-xl border p-2.5 text-left text-[11px]">
          <div className="flex justify-between gap-3"><span className="ticket-proof-muted shrink-0 font-medium">{t('qrClient')}:</span><span className="ticket-proof-value min-w-0 break-words text-right font-bold">{buyerName}</span></div>
          <div className="flex justify-between gap-3"><span className="ticket-proof-muted shrink-0 font-medium">{t('qrContact')}:</span><span className="ticket-proof-value min-w-0 break-words text-right font-bold">{buyerPhone}</span></div>
          {validUntil && (
            <div className="flex justify-between gap-3"><span className="ticket-proof-muted shrink-0 font-medium">{t('qrValidUntil')}:</span><span className="ticket-proof-value min-w-0 break-words text-right font-bold">{formatDateTime(validUntil, currentLang)}</span></div>
          )}
          <div className="ticket-proof-total flex justify-between border-t pt-1.5"><span className="ticket-proof-muted font-medium">{t(amountLabel)}:</span><span className="font-bold font-mono">{formatNumber(amountXOF, currentLang)} XOF</span></div>
        </div>
      </div>

      <div className="ticket-proof-actions grid grid-cols-3 gap-1.5">
        <button type="button" onClick={handleDownloadCode} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border px-1.5 py-1 text-[10px] font-bold transition" title={t('qrDownloadTicketTitle')}>
          <Download className="h-3 w-3" />{t('qrDownloadTicket')}
        </button>
        <button type="button" onClick={handleDownloadQr} disabled={!qrDataUrl} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50" title={t('qrDownloadQrTitle')}>
          <QrCode className="h-3 w-3" />{t('qrDownloadQr')}
        </button>
        <button type="button" onClick={() => void handleDownloadPdf()} disabled={!qrDataUrl} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50" title={t('qrDownloadPdfTitle')}>
          <Download className="h-3 w-3" />{t('qrDownloadPdf')}
        </button>
      </div>

      <p className="text-[9px] text-slate-500 dark:text-slate-500 italic leading-snug">{t('qrSingleUse')}</p>
    </div>
  );
};
