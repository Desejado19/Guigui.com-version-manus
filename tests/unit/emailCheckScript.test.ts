import { describe, expect, it, vi } from 'vitest';
import { probeBrevoKey } from '../../scripts/email-check';

describe('email:check — sonda da chave Brevo', () => {
  it('marca a chave como válida com HTTP 200, sem enviar email', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 }));

    const result = await probeBrevoKey('xkeysib-teste', fetchImpl);

    expect(result.status).toBe('valid');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/account');
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect((init?.headers as Record<string, string>)['api-key']).toBe('xkeysib-teste');
  });

  it.each([401, 403])('marca a chave como inválida com HTTP %i', async (status) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('{}', { status }));
    const result = await probeBrevoKey('xkeysib-recusada', fetchImpl);
    expect(result.status).toBe('invalid');
  });

  it('distingue resposta inesperada de rede indisponível', async () => {
    const serverError = vi.fn<typeof fetch>(async () => new Response('{}', { status: 500 }));
    expect((await probeBrevoKey('xkeysib-x', serverError)).status).toBe('unreachable');

    const networkError = vi.fn<typeof fetch>(async () => {
      throw Object.assign(new Error('fetch failed'), { name: 'TypeError' });
    });
    const probe = await probeBrevoKey('xkeysib-x', networkError);
    expect(probe.status).toBe('unreachable');
    if (probe.status === 'unreachable') expect(probe.detail).not.toContain('xkeysib');
  });

  it('não contacta a Brevo quando a chave não existe', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await probeBrevoKey('   ', fetchImpl);
    expect(result).toEqual({ status: 'skipped', detail: 'BREVO_API_KEY não está definida.' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
