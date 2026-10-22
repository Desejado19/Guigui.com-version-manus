import { describe, expect, it, vi } from 'vitest';
import {
  getPlatformHealth,
  type HealthDependencies,
} from '../../server/modules/platform-foundation/application/getPlatformHealth';

const fixedTime = new Date('2026-10-21T12:00:00.000Z');

function createDependencies(
  overrides: Partial<HealthDependencies> = {},
): HealthDependencies {
  return {
    databaseConfigured: false,
    checkDatabaseConnection: vi.fn().mockResolvedValue({
      configured: true,
      connected: true,
    }),
    geminiActive: () => true,
    logger: { error: vi.fn() },
    now: () => fixedTime,
    ...overrides,
  };
}

describe('getPlatformHealth', () => {
  it('returns healthy local JSON status without probing PostgreSQL', async () => {
    const checkDatabaseConnection = vi.fn().mockResolvedValue({
      configured: false,
      connected: false,
    });

    const result = await getPlatformHealth(createDependencies({
      checkDatabaseConnection,
    }));

    expect(checkDatabaseConnection).not.toHaveBeenCalled();
    expect(result.status).toBe('ok');
    expect(result.database).toEqual({ configured: false, connected: false });
    expect(result.observability).toEqual({ inProcess: true, persistent: false });
  });

  it('returns healthy status when PostgreSQL is connected', async () => {
    const result = await getPlatformHealth(createDependencies({
      databaseConfigured: true,
      checkDatabaseConnection: vi.fn().mockResolvedValue({
        configured: true,
        connected: true,
      }),
    }));

    expect(result.status).toBe('ok');
    expect(result.database).toEqual({ configured: true, connected: true });
    expect(result.observability.persistent).toBe(true);
  });

  it('returns degraded and logs when the configured database probe fails', async () => {
    const logger = { error: vi.fn() };
    const result = await getPlatformHealth(createDependencies({
      databaseConfigured: true,
      checkDatabaseConnection: vi.fn().mockRejectedValue(new Error('database unavailable')),
      logger,
    }));

    expect(result.status).toBe('degraded');
    expect(result.database).toEqual({ configured: true, connected: false });
    expect(logger.error).toHaveBeenCalledWith(
      '[Guigui.com] health database check failed:',
      'database unavailable',
    );
  });

  it('preserves optional AI status in the health response', async () => {
    const result = await getPlatformHealth(createDependencies({
      geminiActive: () => false,
    }));

    expect(result.geminiActive).toBe(false);
  });

  it('returns the application name and timestamp from the injected clock', async () => {
    const result = await getPlatformHealth(createDependencies());

    expect(result.app).toBe('Guigui.com Bissau');
    expect(result.timestamp).toBe('2026-10-21T12:00:00.000Z');
  });
});
