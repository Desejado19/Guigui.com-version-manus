import { describe, expect, it } from 'vitest';
import { resolveEmailConfig } from '../../server/email/config';

const production = { NODE_ENV: 'production', APP_URL: 'https://guigui.com' } as NodeJS.ProcessEnv;

describe('resolveEmailConfig', () => {
  it('refuses to invent a provider in production', () => {
    const resolution = resolveEmailConfig({ ...production });
    expect(resolution.ready).toBe(false);
    if (resolution.ready) return;
    expect(resolution.issues.join(' ')).toContain('Produção exige');
  });

  it('stays simulated in development without an explicit provider', () => {
    const resolution = resolveEmailConfig({ NODE_ENV: 'development' });
    expect(resolution.ready).toBe(false);
    if (resolution.ready) return;
    expect(resolution.issues.join(' ')).toContain('modo simulado');
  });

  it('requires EMAIL_FROM in production even with Brevo configured', () => {
    const resolution = resolveEmailConfig({
      ...production,
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'xkeysib-test',
    });
    expect(resolution.ready).toBe(false);
    if (resolution.ready) return;
    expect(resolution.issues.join(' ')).toContain('EMAIL_FROM');
  });

  it('resolves a live Brevo configuration', () => {
    const resolution = resolveEmailConfig({
      ...production,
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'xkeysib-test',
      EMAIL_FROM: 'Guigui.com <no-reply@guigui.com>',
      EMAIL_REPLY_TO: 'suporte@guigui.com',
      EMAIL_MAX_ATTEMPTS: '99',
    });
    expect(resolution.ready).toBe(true);
    if (!resolution.ready) return;
    expect(resolution.config.provider).toBe('brevo');
    expect(resolution.config.mode).toBe('live');
    expect(resolution.config.from).toEqual({ email: 'no-reply@guigui.com', name: 'Guigui.com' });
    expect(resolution.config.replyTo?.email).toBe('suporte@guigui.com');
    expect(resolution.config.maxAttempts).toBe(5);
    expect(resolution.config.brevo?.apiKey).toBe('xkeysib-test');
    expect(resolution.config.localMailbox).toBe(false);
  });

  it('uses an explicitly configured Mailpit in development', () => {
    const resolution = resolveEmailConfig({
      NODE_ENV: 'development',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '1025',
    });
    expect(resolution.ready).toBe(true);
    if (!resolution.ready) return;
    expect(resolution.config.provider).toBe('smtp');
    expect(resolution.config.mode).toBe('development');
    expect(resolution.config.smtp).toMatchObject({ host: '127.0.0.1', port: 1025, secure: false });
    expect(resolution.config.localMailbox).toBe(true);
    expect(resolution.config.from.email).toBe('no-reply@guigui.local');
    expect(resolution.config.warnings.join(' ')).toContain('caixa local');
  });

  it('prefers Brevo in development when the API key exists', () => {
    const resolution = resolveEmailConfig({ NODE_ENV: 'development', BREVO_API_KEY: 'xkeysib-test' });
    expect(resolution.ready).toBe(true);
    if (!resolution.ready) return;
    expect(resolution.config.provider).toBe('brevo');
    expect(resolution.config.mode).toBe('development');
  });

  it('does not treat a remote SMTP relay as a local mailbox', () => {
    const resolution = resolveEmailConfig({
      NODE_ENV: 'development',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
    });
    expect(resolution.ready).toBe(true);
    if (!resolution.ready) return;
    expect(resolution.config.localMailbox).toBe(false);
  });

  it('fails when EMAIL_PROVIDER=smtp has no host in production', () => {
    const resolution = resolveEmailConfig({
      ...production,
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'no-reply@guigui.com',
    });
    expect(resolution.ready).toBe(false);
    if (resolution.ready) return;
    expect(resolution.issues.join(' ')).toContain('SMTP_HOST');
  });

  it('fails explicitly when email is disabled or the provider name is unknown', () => {
    expect(resolveEmailConfig({ ...production, EMAIL_PROVIDER: 'none' })).toMatchObject({
      ready: false,
    });
    expect(resolveEmailConfig({ ...production, EMAIL_PROVIDER: 'sendgrid' })).toMatchObject({
      ready: false,
    });
  });

  it('rejects an invalid sender address', () => {
    const resolution = resolveEmailConfig({
      ...production,
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'xkeysib-test',
      EMAIL_FROM: 'Guigui.com',
    });
    expect(resolution.ready).toBe(false);
    if (resolution.ready) return;
    expect(resolution.issues.join(' ')).toContain('EMAIL_FROM');
  });
});
