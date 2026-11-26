import { describe, expect, it } from 'vitest';
import { renderEmailLayout } from '../../server/email/layout';

describe('renderEmailLayout', () => {
  it('renders a responsive document with the Guigui identity', () => {
    const { html } = renderEmailLayout({
      locale: 'pt',
      title: 'Bem-vindo ao Guigui.com',
      intro: 'A sua conta está quase pronta.',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('name="viewport" content="width=device-width,initial-scale=1"');
    expect(html).toContain('@media (max-width:600px)');
    expect(html).toContain('.gg-button{display:block!important;width:100%!important');
    expect(html).toContain('Guigui.com');
    expect(html).toContain('#08794f');
  });

  it('escapes user-provided text and blocks unsafe action URLs', () => {
    const { html, text } = renderEmailLayout({
      locale: 'pt',
      title: '<b>Olá</b>',
      sections: [{ type: 'paragraph', text: '<script>alert(1)</script>' }],
      action: { label: 'Abrir', url: 'javascript:alert(1)' },
    });

    expect(html).toContain('&lt;b&gt;Olá&lt;/b&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('href="#"');
    // Em texto simples não há escape HTML: o consumidor não interpreta markup.
    expect(text).toContain('<script>alert(1)</script>');
  });

  it('renders panels, lists and a real action button', () => {
    const { html, text } = renderEmailLayout({
      locale: 'pt',
      title: 'Compra confirmada',
      sections: [
        { type: 'panel', title: 'Resumo', rows: [{ label: 'Evento', value: 'Concerto' }] },
        { type: 'list', items: ['Bilhete A', 'Bilhete B'] },
        { type: 'callout', text: 'Não partilhe o PIN.', tone: 'warning' },
      ],
      action: { label: 'Ver bilhetes', url: 'https://guigui.com/bilhetes' },
    });

    expect(html).toContain('href="https://guigui.com/bilhetes"');
    expect(html).toContain('Ver bilhetes');
    expect(text).toContain('Evento: Concerto');
    expect(text).toContain('- Bilhete A');
    expect(text).toContain('Ver bilhetes: https://guigui.com/bilhetes');
  });

  it('includes the hidden preheader and locale-specific footer', () => {
    const { html } = renderEmailLayout({
      locale: 'en',
      title: 'Reset your password',
      preheader: 'This link expires in 15 minutes.',
    });

    expect(html).toContain('This link expires in 15 minutes.');
    expect(html).toContain('display:none');
    expect(html).toContain('You received this email because you have a Guigui.com account.');
  });

  it('renders the legal footer and preference links when provided', () => {
    const { html, text } = renderEmailLayout({
      locale: 'pt',
      title: 'Segurança da conta',
      footer: {
        legalName: 'Guigui.com Lda',
        legalAddress: 'Bissau, Guiné-Bissau',
        preferencesUrl: 'https://guigui.com/preferencias',
        helpUrl: 'https://guigui.com/ajuda',
      },
    });

    expect(html).toContain('Guigui.com Lda');
    expect(html).toContain('https://guigui.com/preferencias');
    expect(text).toContain('Precisa de ajuda? https://guigui.com/ajuda');
  });
});
