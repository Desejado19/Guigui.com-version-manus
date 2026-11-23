import { describe, expect, it } from 'vitest';
import {
  formatEmailAddress,
  normaliseEmailAddress,
  validateEmailContent,
  MAX_HTML_BYTES,
  MAX_ATTACHMENTS_BYTES,
} from '../../server/email/validation';

describe('normaliseEmailAddress', () => {
  it('extracts the display name and normalises the domain case', () => {
    const result = normaliseEmailAddress('  Ana Silva <Ana@Guigui.COM> ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ email: 'Ana@guigui.com', name: 'Ana Silva' });
  });

  it('accepts a plain address', () => {
    const result = normaliseEmailAddress('cidadao@guigui.com');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe('cidadao@guigui.com');
  });

  it('rejects header injection through CR/LF', () => {
    const result = normaliseEmailAddress('ana@guigui.com\r\nBcc: evil@example.com');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('recipient_invalid');
  });

  it('rejects multiple recipients in a single field', () => {
    expect(normaliseEmailAddress('ana@guigui.com, evil@example.com').ok).toBe(false);
    expect(normaliseEmailAddress('ana@guigui.com evil@example.com').ok).toBe(false);
    expect(normaliseEmailAddress('ana@guigui.com;evil@example.com').ok).toBe(false);
  });

  it('rejects malformed and oversized addresses', () => {
    expect(normaliseEmailAddress('sem-arroba').ok).toBe(false);
    expect(normaliseEmailAddress('ana@').ok).toBe(false);
    expect(normaliseEmailAddress('.ana@guigui.com').ok).toBe(false);
    expect(normaliseEmailAddress(`${'a'.repeat(250)}@guigui.com`).ok).toBe(false);
  });

  it('only allows local domains when explicitly enabled (Mailpit)', () => {
    expect(normaliseEmailAddress('qa@localhost').ok).toBe(false);
    const allowed = normaliseEmailAddress('qa@localhost', { allowLocalDomain: true });
    expect(allowed.ok).toBe(true);
  });

  it('strips control characters from the display name', () => {
    const result = normaliseEmailAddress({ email: 'ana@guigui.com', name: 'Ana\r\nBcc: evil@example.com' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).not.toMatch(/[\r\n]/);
  });
});

describe('formatEmailAddress', () => {
  it('formats and sanitises the display name', () => {
    expect(formatEmailAddress({ email: 'ana@guigui.com', name: 'Ana <Silva>' })).toBe(
      'Ana Silva <ana@guigui.com>',
    );
    expect(formatEmailAddress({ email: 'ana@guigui.com' })).toBe('ana@guigui.com');
  });
});

describe('validateEmailContent', () => {
  const valid = {
    subject: 'Redefinir palavra-passe',
    html: '<p>Olá</p>',
    text: 'Olá',
  };

  it('accepts a valid message', () => {
    expect(validateEmailContent(valid).ok).toBe(true);
  });

  it('removes CR/LF from the subject instead of allowing header injection', () => {
    const result = validateEmailContent({ ...valid, subject: 'Olá\r\nBcc: evil@example.com' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subject).toBe('Olá Bcc: evil@example.com');
  });

  it('rejects empty subject, html and text', () => {
    expect(validateEmailContent({ ...valid, subject: '   ' })).toMatchObject({ ok: false, code: 'subject_missing' });
    expect(validateEmailContent({ ...valid, html: '' })).toMatchObject({ ok: false, code: 'html_missing' });
    expect(validateEmailContent({ ...valid, text: '' })).toMatchObject({ ok: false, code: 'text_missing' });
  });

  it('rejects bodies above the size limits', () => {
    expect(validateEmailContent({ ...valid, html: 'a'.repeat(MAX_HTML_BYTES + 1) })).toMatchObject({
      ok: false,
      code: 'html_too_large',
    });
  });

  it('sanitises attachment filenames and enforces the total size', () => {
    const result = validateEmailContent({
      ...valid,
      attachments: [{ filename: '../../etc/passwd', content: Buffer.from('qr') }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attachments?.[0].filename).not.toMatch(/[\\/]/);

    expect(
      validateEmailContent({
        ...valid,
        attachments: [
          { filename: 'a.bin', content: Buffer.alloc(MAX_ATTACHMENTS_BYTES) },
          { filename: 'b.bin', content: Buffer.alloc(1024) },
        ],
      }),
    ).toMatchObject({ ok: false, code: 'attachments_too_large' });
  });

  it('rejects empty attachments', () => {
    expect(
      validateEmailContent({ ...valid, attachments: [{ filename: 'vazio.png', content: Buffer.alloc(0) }] }),
    ).toMatchObject({ ok: false, code: 'attachment_empty' });
  });
});
