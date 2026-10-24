import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertRunningTarget } from '../../scripts/qa/assert-running-target';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('assertRunningTarget', () => {
  it('checks the local health endpoint without following redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"status":"ok"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await assertRunningTarget('http://127.0.0.1:4313');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4313/api/health', {
      method: 'GET',
      redirect: 'manual',
    });
  });

  it.each([
    'http://127.0.0.1:3000',
    'https://example.com:4313',
    '',
  ])('rejects a non-QA target before making a request: %s', async (baseUrl) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(assertRunningTarget(baseUrl)).rejects.toThrow(/QA target/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects cross-origin redirects without following them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/login' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(assertRunningTarget('http://127.0.0.1:4313')).rejects.toThrow(/redirect/i);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sanitizes unavailable-target errors and does not print connection details', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:4313'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', fetchMock);

    let error: unknown;
    try {
      await assertRunningTarget('http://127.0.0.1:4313');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw new Error('expected target verification to fail');
    expect(error.message).toMatch(/health endpoint/i);
    expect(error.message).not.toContain('ECONNREFUSED');
    expect(error.message).not.toContain('127.0.0.1');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
