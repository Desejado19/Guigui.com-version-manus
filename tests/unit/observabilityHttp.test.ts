import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express, { type Express } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { HttpMetricsRegistry } from '../../server/modules/platform-foundation/observability/domain/httpMetrics';
import type { ObservabilityRepository } from '../../server/modules/platform-foundation/observability/application/observabilityService';
import { createObservabilityHandlers } from '../../server/modules/platform-foundation/observability/http/observabilityHandlers';
import { createObservabilityMiddleware } from '../../server/modules/platform-foundation/observability/http/observabilityMiddleware';

async function withServer<T>(
  app: Express,
  action: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address() as AddressInfo;
  try {
    return await action(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function createRepository(
  overrides: Partial<ObservabilityRepository> = {},
): ObservabilityRepository {
  return {
    persistRequestMetric: vi.fn().mockResolvedValue(undefined),
    getDatabaseObservability: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function createMiddleware(
  registry: HttpMetricsRegistry,
  repository: ObservabilityRepository,
  overrides: Partial<Parameters<typeof createObservabilityMiddleware>[0]> = {},
) {
  return createObservabilityMiddleware({
    registry,
    persistRequestMetric: repository.persistRequestMetric,
    requestIdFrom: (request) => request.header('x-request-id') || 'generated-id',
    logger: { error: vi.fn(), log: vi.fn() },
    ...overrides,
  });
}

describe('HTTP observability adapters', () => {
  it('records a completed response and preserves its request ID', async () => {
    const registry = new HttpMetricsRegistry();
    const repository = createRepository();
    const app = express();
    app.use(createMiddleware(registry, repository));
    let completeResponse: (() => void) | undefined;
    let markRequestStarted: (() => void) | undefined;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    app.get('/health', (_request, response) => {
      completeResponse = () => response.status(200).send('healthy');
      markRequestStarted?.();
    });

    await withServer(app, async (baseUrl) => {
      const responsePromise = fetch(`${baseUrl}/health`, {
        headers: { 'X-Request-Id': 'request-123' },
      });
      await requestStarted;
      expect(registry.snapshot().totalRequests).toBe(0);
      if (!completeResponse) throw new Error('Expected a response completion callback');
      completeResponse();
      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(response.headers.get('x-request-id')).toBe('request-123');
      expect(registry.snapshot()).toMatchObject({
        totalRequests: 1,
        errors: 0,
      });
      expect(registry.snapshot().routes.get('/health')).toEqual({
        count: 1,
        errors: 0,
        totalMs: expect.any(Number),
      });
    });
  });

  it('logs persistence failure without changing the completed response', async () => {
    const registry = new HttpMetricsRegistry();
    const logger = { error: vi.fn(), log: vi.fn() };
    const repository = createRepository({
      persistRequestMetric: vi.fn().mockRejectedValue(new Error('database unavailable')),
    });
    const app = express();
    app.use(createMiddleware(registry, repository, { logger }));
    app.get('/health', (_request, response) => response.status(200).send('healthy'));
    const persistenceFailureLogged = new Promise<void>((resolve) => {
      logger.error.mockImplementation(() => resolve());
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`, {
        headers: { 'X-Request-Id': 'request-456' },
      });
      await persistenceFailureLogged;

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('healthy');
      expect(logger.error).toHaveBeenCalledWith(JSON.stringify({
        event: 'observability_persist_failed',
        requestId: 'request-456',
        message: 'database unavailable',
      }));
    });
  });

  it('logs 4xx and slow responses but not ordinary successful responses', async () => {
    const registry = new HttpMetricsRegistry();
    const repository = createRepository();
    const logger = { error: vi.fn(), log: vi.fn() };
    const times = [0, 10, 20, 30, 40, 1040];
    const app = express();
    app.use(createMiddleware(registry, repository, {
      logger,
      now: () => times.shift() ?? 1040,
    }));
    app.get('/fast', (_request, response) => response.send('ok'));
    app.get('/slow', (_request, response) => response.send('ok'));

    await withServer(app, async (baseUrl) => {
      await fetch(`${baseUrl}/fast`);
      await fetch(`${baseUrl}/missing`);
      await fetch(`${baseUrl}/slow`);

      expect(logger.log).toHaveBeenCalledTimes(2);
      expect(logger.log).toHaveBeenNthCalledWith(1, expect.stringContaining('"status":404'));
      expect(logger.log).toHaveBeenNthCalledWith(2, expect.stringContaining('"durationMs":1000'));
    });
  });

  it('returns the admin summary as JSON', async () => {
    const registry = new HttpMetricsRegistry();
    registry.record('/health', 200, 8);
    const handlers = createObservabilityHandlers({
      registry,
      repository: createRepository(),
    });
    const app = express();
    app.get('/api/metrics', handlers.adminMetrics);

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/metrics`);

      expect(response.headers.get('content-type')).toContain('application/json');
      await expect(response.json()).resolves.toEqual({
        totalRequests: 1,
        errors: 0,
        routes: [{ route: '/health', count: 1, errors: 0, averageMs: 8 }],
        database: null,
      });
    });
  });

  it('returns Prometheus exposition as public plain text', async () => {
    const registry = new HttpMetricsRegistry();
    registry.record('/health', 200, 8);
    const handlers = createObservabilityHandlers({
      registry,
      repository: createRepository(),
    });
    const app = express();
    app.get('/metrics', handlers.prometheusMetrics);

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/metrics`);
      const text = await response.text();

      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(text).toContain('# TYPE guigui_http_requests_total counter');
      expect(text.endsWith('\n')).toBe(true);
    });
  });

  it('forwards database read failures to Express error middleware', async () => {
    const failure = new Error('metrics query failed');
    const handlers = createObservabilityHandlers({
      registry: new HttpMetricsRegistry(),
      repository: createRepository({
        getDatabaseObservability: vi.fn().mockRejectedValue(failure),
      }),
    });
    let forwardedError: unknown;
    const app = express();
    app.get('/api/metrics', handlers.adminMetrics);
    app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
      forwardedError = error;
      response.status(500).end();
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/metrics`);

      expect(response.status).toBe(500);
      expect(forwardedError).toBe(failure);
    });
  });
});
