import { afterEach, describe, expect, it, vi } from 'vitest';
import { persistModerationDecision } from '../../src/utils/moderationPersistence';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('persistModerationDecision', () => {
  it('resolve apenas quando o servidor confirma com success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, log: { id: 'mod-1', status: 'approved' } }),
    }) as unknown as typeof fetch;

    await expect(persistModerationDecision('mod-1', 'approve')).resolves.toMatchObject({
      success: true,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/moderation/review', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ id: 'mod-1', action: 'approve', notes: undefined }),
    }));
  });

  it('propaga a mensagem do servidor numa falha HTTP', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Apenas a administração pode decidir.' }),
    }) as unknown as typeof fetch;

    await expect(persistModerationDecision('mod-1', 'approve')).rejects.toThrow(
      'Apenas a administração pode decidir.',
    );
  });

  it('usa a mensagem de estado quando a falha HTTP não tem corpo JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new Error('not json'); },
    }) as unknown as typeof fetch;

    await expect(persistModerationDecision('mod-1', 'reject', 'motivo')).rejects.toThrow(
      'Falha ao persistir decisão (503).',
    );
  });

  it('rejeita uma resposta 200 sem confirmação explícita do servidor', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ persisted: true }),
    }) as unknown as typeof fetch;

    await expect(persistModerationDecision('mod-1', 'appeal')).rejects.toThrow(
      'O servidor não confirmou a operação de moderação.',
    );
  });

  it('não engole falhas de rede', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await expect(persistModerationDecision('mod-1', 'simulate-appeal')).rejects.toThrow(
      'Failed to fetch',
    );
  });
});
