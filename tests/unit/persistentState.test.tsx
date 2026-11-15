// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPersistentStateScope, usePersistentState } from '../../src/utils/persistentState';

const KEY = 'guigui_user_posts';
const cacheKey = (scope: string) => `guigui:state:${scope}:${KEY}`;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('usePersistentState — persistência e isolamento', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    setPersistentStateScope('anon');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('não reenvia o cache antigo por cima do valor mais recente da base de dados', async () => {
    setPersistentStateScope('user:u1:');
    window.localStorage.setItem(cacheKey('user:u1:'), JSON.stringify([{ id: 'stale' }]));

    const methods: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit = {}) => {
      methods.push(init.method || 'GET');
      if ((init.method || 'GET') === 'GET') {
        return jsonResponse({
          key: KEY,
          value: [{ id: 'server-new' }],
          updatedAt: '2026-01-01T00:00:10.000Z',
        });
      }
      return jsonResponse({ success: true, value: [{ id: 'server-new' }], updatedAt: '2026-01-01T00:00:11.000Z' });
    }));

    const { result } = renderHook(() => usePersistentState<Array<{ id: string }>>(KEY, []));

    await waitFor(() => expect(result.current[0]).toEqual([{ id: 'server-new' }]));
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(methods.filter((method) => method === 'POST')).toHaveLength(0);
  });

  it('grava a alteração local depois da leitura inicial, com o valor novo', async () => {
    setPersistentStateScope('user:u1:');
    const bodies: Array<{ value?: unknown }> = [];

    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit = {}) => {
      if ((init.method || 'GET') === 'GET') {
        return jsonResponse({ key: KEY, value: [], updatedAt: '2026-01-01T00:00:10.000Z' });
      }
      bodies.push(JSON.parse(String(init.body || '{}')));
      return jsonResponse({ success: true, value: [{ id: 'new-post' }], updatedAt: '2026-01-01T00:00:12.000Z' });
    }));

    const { result } = renderHook(() => usePersistentState<Array<{ id: string }>>(KEY, []));
    await new Promise((resolve) => setTimeout(resolve, 50));

    await act(async () => {
      result.current[1]([{ id: 'new-post' }]);
    });

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0), { timeout: 2500 });
    expect(bodies[0].value).toEqual([{ id: 'new-post' }]);
    await waitFor(() => expect(result.current[0]).toEqual([{ id: 'new-post' }]));
  });

  it('envia uma alteração feita antes da leitura inicial terminar', async () => {
    setPersistentStateScope('user:u1:');
    let resolveGet: ((value: Response) => void) | undefined;
    const bodies: Array<{ value?: unknown }> = [];

    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit = {}) => {
      if ((init.method || 'GET') === 'GET') {
        return new Promise<Response>((resolve) => { resolveGet = resolve; });
      }
      bodies.push(JSON.parse(String(init.body || '{}')));
      return jsonResponse({ success: true, value: [{ id: 'early-edit' }], updatedAt: '2026-01-01T00:00:12.000Z' });
    }));

    const { result } = renderHook(() => usePersistentState<Array<{ id: string }>>(KEY, []));
    await act(async () => {
      result.current[1]([{ id: 'early-edit' }]);
    });

    expect(bodies).toHaveLength(0);
    await act(async () => {
      resolveGet?.(jsonResponse({ key: KEY, value: [], updatedAt: '2026-01-01T00:00:10.000Z' }) as Response);
    });

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0), { timeout: 2500 });
    expect(bodies[0].value).toEqual([{ id: 'early-edit' }]);
  });

  it('recarrega o cache do novo perfil ao trocar de conta', async () => {
    setPersistentStateScope('user:u1:');
    window.localStorage.setItem(cacheKey('user:u1:'), JSON.stringify([{ id: 'u1-only' }]));
    window.localStorage.setItem(cacheKey('user:u2:'), JSON.stringify([{ id: 'u2-only' }]));

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));

    const { result } = renderHook(() => usePersistentState<Array<{ id: string }>>(KEY, []));
    await waitFor(() => expect(result.current[0]).toEqual([{ id: 'u1-only' }]));

    act(() => setPersistentStateScope('user:u2:'));

    await waitFor(() => expect(result.current[0]).toEqual([{ id: 'u2-only' }]));
  });
});
