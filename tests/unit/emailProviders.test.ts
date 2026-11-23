import { describe, expect, it } from 'vitest';
import { createBrevoEmailProvider, type BrevoFetch } from '../../server/email/providers/brevo';
import { createSmtpEmailProvider } from '../../server/email/providers/smtp';
import type { EmailProviderMessage } from '../../server/email/types';

const message: EmailProviderMessage = {
  from: { email: 'no-reply@guigui.com', name: 'Guigui.com' },
  to: { email: 'cidadao@guigui.com', name: 'Cidadão' },
  subject: 'Bem-vindo',
  html: '<p>Olá</p>',
  text: 'Olá',
  attachments: [{ filename: 'qr.png', content: Buffer.from('png'), contentType: 'image/png' }],
  headers: { 'X-Guigui-Email-Kind': 'ticket_delivery' },
};

function brevoWith(response: {
  status: number;
  body?: unknown;
}): { provider: ReturnType<typeof createBrevoEmailProvider>; calls: Array<{ url: string; init: Parameters<BrevoFetch>[1] }> } {
  const calls: Array<{ url: string; init: Parameters<BrevoFetch>[1] }> = [];
  const provider = createBrevoEmailProvider({
    apiKey: 'test-key',
    mode: 'development',
    timeoutMs: 1000,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        text: async () => (response.body === undefined ? '' : JSON.stringify(response.body)),
        headers: { get: () => null },
      };
    },
  });
  return { provider, calls };
}

describe('Brevo provider', () => {
  it('posts the documented payload and reads the message id', async () => {
    const { provider, calls } = brevoWith({
      status: 201,
      body: { messageId: '<201@brevo>' },
    });

    const receipt = await provider.send(message);

    expect(receipt.providerMessageId).toBe('<201@brevo>');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['api-key']).toBe('test-key');

    const payload = JSON.parse(calls[0].init.body) as Record<string, any>;
    expect(payload.sender).toEqual({ email: 'no-reply@guigui.com', name: 'Guigui.com' });
    expect(payload.to).toEqual([{ email: 'cidadao@guigui.com', name: 'Cidadão' }]);
    expect(payload.subject).toBe('Bem-vindo');
    expect(payload.htmlContent).toBe('<p>Olá</p>');
    expect(payload.textContent).toBe('Olá');
    expect(payload.headers).toEqual({ 'X-Guigui-Email-Kind': 'ticket_delivery' });
    expect(payload.attachment[0].name).toBe('qr.png');
    expect(payload.attachment[0].content).toBe(Buffer.from('png').toString('base64'));
  });

  it('marks rate limiting and server errors as retriable failures', async () => {
    await expect(
      brevoWith({ status: 429, body: { code: 'too_many_requests' } }).provider.send(message),
    ).rejects.toMatchObject({
      code: 'brevo_rate_limited',
      retriable: true,
      outcome: 'failed',
      httpStatus: 429,
    });

    await expect(brevoWith({ status: 503, body: {} }).provider.send(message)).rejects.toMatchObject({
      code: 'brevo_server_error',
      retriable: true,
    });
  });

  it('marks an invalid recipient as a permanent rejection', async () => {
    await expect(
      brevoWith({
        status: 400,
        body: { code: 'invalid_parameter', message: 'email is not valid' },
      }).provider.send(message),
    ).rejects.toMatchObject({
      code: 'brevo_recipient_rejected',
      retriable: false,
      outcome: 'rejected',
    });
  });

  it('does not retry an authentication failure', async () => {
    await expect(
      brevoWith({ status: 401, body: { code: 'unauthorized' } }).provider.send(message),
    ).rejects.toMatchObject({
      code: 'brevo_auth_failed',
      retriable: false,
      outcome: 'failed',
    });
  });

  it('treats network errors and timeouts as retriable', async () => {
    const provider = createBrevoEmailProvider({
      apiKey: 'test-key',
      mode: 'live',
      fetchImpl: async () => {
        throw new Error('getaddrinfo ENOTFOUND api.brevo.com');
      },
    });

    await expect(provider.send(message)).rejects.toMatchObject({
      code: 'brevo_network_error',
      retriable: true,
    });
  });
});

describe('SMTP provider', () => {
  it('sends through the transport with a plain-text alternative and attachments', async () => {
    const sent: Array<Record<string, unknown>> = [];
    const provider = createSmtpEmailProvider({
      host: '127.0.0.1',
      port: 1025,
      secure: false,
      mode: 'development',
      transport: {
        async sendMail(options) {
          sent.push(options);
          return { messageId: '<smtp-1@local>', accepted: ['cidadao@guigui.com'], rejected: [] };
        },
      },
    });

    const receipt = await provider.send(message);

    expect(provider.name).toBe('smtp');
    expect(provider.mode).toBe('development');
    expect(receipt.providerMessageId).toBe('<smtp-1@local>');
    expect(sent[0].from).toBe('Guigui.com <no-reply@guigui.com>');
    expect(sent[0].to).toBe('Cidadão <cidadao@guigui.com>');
    expect(sent[0].text).toBe('Olá');
    expect(sent[0].html).toBe('<p>Olá</p>');
    expect((sent[0].attachments as Array<Record<string, unknown>>)[0].filename).toBe('qr.png');
  });

  it('rejects permanently when the server refuses the recipient', async () => {
    const provider = createSmtpEmailProvider({
      host: '127.0.0.1',
      port: 1025,
      secure: false,
      mode: 'development',
      transport: {
        async sendMail() {
          return { accepted: [], rejected: ['cidadao@guigui.com'], response: '550 mailbox unavailable' };
        },
      },
    });

    await expect(provider.send(message)).rejects.toMatchObject({
      code: 'smtp_recipient_rejected',
      retriable: false,
      outcome: 'rejected',
    });
  });

  it('classifies authentication errors as permanent failures', async () => {
    const provider = createSmtpEmailProvider({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      mode: 'live',
      transport: {
        async sendMail() {
          throw Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535 });
        },
      },
    });

    await expect(provider.send(message)).rejects.toMatchObject({
      code: 'smtp_auth_failed',
      retriable: false,
      outcome: 'failed',
    });
  });

  it('retries SMTP 4xx temporary failures', async () => {
    const provider = createSmtpEmailProvider({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      mode: 'live',
      transport: {
        async sendMail() {
          throw Object.assign(new Error('Try again later'), { responseCode: 451 });
        },
      },
    });

    await expect(provider.send(message)).rejects.toMatchObject({
      code: 'smtp_temporary_failure',
      retriable: true,
      outcome: 'failed',
    });
  });
});
