// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { QRCodeDisplay } from '../../../src/components/QRCodeDisplay';
import { getTranslation } from '../../../src/utils/i18n';

const base = {
  code: 'TKT-ABC123',
  qrToken: 'token-abc',
  title: 'Noite de Tabanka',
  buyerName: 'Aissatu Mané',
  buyerPhone: '+2459550000',
  amountXOF: 5000,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('QRCodeDisplay — tradução do bilhete', () => {
  it('mostra os rótulos em português por omissão', () => {
    render(<QRCodeDisplay {...base} />);
    expect(screen.getByText('Cliente:')).toBeTruthy();
    expect(screen.getByText('Código alfanumérico único')).toBeTruthy();
  });

  it('traduz os rótulos para francês', () => {
    render(<QRCodeDisplay {...base} currentLang="fr" />);
    expect(screen.getByText('Client:')).toBeTruthy();
    expect(screen.getByText('Code alphanumérique unique')).toBeTruthy();
  });

  it('formata o valor no padrão do idioma escolhido', () => {
    // 5000 XOF: pt e en usam separador de milhar, fr usa espaço fino.
    const { unmount } = render(<QRCodeDisplay {...base} currentLang="fr" />);
    const french = screen.getByText(/XOF$/).textContent || '';
    unmount();
    render(<QRCodeDisplay {...base} currentLang="pt" />);
    const portuguese = screen.getByText(/XOF$/).textContent || '';
    expect(french).not.toBe(portuguese);
    expect(portuguese).toContain('5.000');
  });

  it('traduz o estado do bilhete', () => {
    render(<QRCodeDisplay {...base} currentLang="es" status="cancelled" />);
    expect(screen.getByText('Entrada cancelada')).toBeTruthy();
  });

  it('mostra o PIN de validação traduzido', () => {
    render(<QRCodeDisplay {...base} currentLang="en" pinCode="1234" />);
    expect(screen.getByText('Validation PIN')).toBeTruthy();
    expect(screen.getByText('1234')).toBeTruthy();
  });
});

describe('Chaves de tradução do bilhete', () => {
  const keys = [
    'qrHeader', 'qrCancelled', 'qrRedeemed', 'qrPending', 'qrGenerating',
    'qrGenerationFailed', 'qrIdentifier', 'qrCodeLabel', 'qrPin', 'qrNotAvailable',
    'qrDownloadTicket', 'qrDownloadQr', 'qrDownloadPdf', 'qrCopyCode',
    'qrClient', 'qrContact', 'qrValidUntil', 'qrAmountPaid', 'qrSingleUse',
    'qrAltText', 'qrPdfSubtitle', 'qrPdfBuyer', 'qrPdfCode', 'qrPdfValue',
    'qrPdfValidUntil', 'qrPdfPresent', 'qrPdfFootnote', 'qrTxtEvent',
    'qrTxtTicket', 'qrTxtPurchaseCode', 'qrTxtPresent',
  ];

  it('existem em português, inglês, francês, espanhol e crioulo', () => {
    for (const lang of ['pt', 'en', 'fr', 'es'] as const) {
      for (const key of keys) {
        const value = getTranslation(lang, key);
        expect(value, `${lang}.${key} em falta`).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('nenhuma tradução devolve a própria chave (fallback silencioso)', () => {
    for (const lang of ['pt', 'en', 'fr', 'es'] as const) {
      for (const key of keys) {
        expect(getTranslation(lang, key)).not.toMatch(/^[a-z][A-Za-z]+$/);
      }
    }
  });
});
