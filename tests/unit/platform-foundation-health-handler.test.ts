import { createServer, type Server } from 'node:http';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { HealthDependencies } from '../../server/modules/platform-foundation/application/getPlatformHealth';
import { createHealthHandler } from '../../server/modules/platform-foundation/http/healthHandler';

async function requestHealth(
  dependencies: HealthDependencies,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.get('/health', createHealthHandler(dependencies));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  });

  const server: Server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('The health test server did not bind to a TCP address.');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    return {
      status: response.status,
      body: await response.json() as Record<string, unknown>,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function createDependencies(
  overrides: Partial<HealthDependencies> = {},
): HealthDependencies {
  return {
    databaseConfigured: false,
    checkDatabaseConnection: vi.fn().mockResolvedValue({
      configured: false,
      connected: false,
    }),
    geminiActive: () => false,
    logger: { error: vi.fn() },
    now: () => new Date('2026-10-21T12:00:00.000Z'),
    ...overrides,
  };
}

describe('createHealthHandler', () => {
  it('serializes platform health as JSON over HTTP', async () => {
    const result = await requestHealth(createDependencies());

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      status: 'ok',
      app: 'Guigui.com Bissau',
      geminiActive: false,
      database: { configured: false, connected: false },
      observability: { inProcess: true, persistent: false },
    });
    expect(result.body.timestamp).toBe('2026-10-21T12:00:00.000Z');
  });

  it('forwards unexpected health failures to Express error middleware', async () => {
    const result = await requestHealth(createDependencies({
      geminiActive: () => {
        throw new Error('AI status unavailable');
      },
    }));

    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: 'AI status unavailable' });
  });
});
