import type { Request, RequestHandler } from 'express';
import type { HttpMetricsRegistry } from '../domain/httpMetrics';

export type ObservabilityMiddlewareDependencies = {
  registry: HttpMetricsRegistry;
  persistRequestMetric: (route: string, statusCode: number, durationMs: number) => Promise<void>;
  requestIdFrom: (request: Request) => string;
  logger: Pick<Console, 'error' | 'log'>;
  now?: () => number;
};

export function createObservabilityMiddleware(
  dependencies: ObservabilityMiddlewareDependencies,
): RequestHandler {
  const now = dependencies.now ?? (() => performance.now());
  return (request, response, next) => {
    const startedAt = now();
    const requestId = dependencies.requestIdFrom(request);
    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () => {
      const durationMs = Math.round((now() - startedAt) * 100) / 100;
      const route = request.route?.path || request.path;
      dependencies.registry.record(route, response.statusCode, durationMs);
      void dependencies.persistRequestMetric(route, response.statusCode, durationMs).catch((error: unknown) => {
        dependencies.logger.error(JSON.stringify({
          event: 'observability_persist_failed',
          requestId,
          message: error instanceof Error ? error.message : 'unknown_error',
        }));
      });
      if (response.statusCode >= 400 || durationMs >= 1000) {
        dependencies.logger.log(JSON.stringify({
          event: 'http_request',
          requestId,
          method: request.method,
          route,
          status: response.statusCode,
          durationMs,
        }));
      }
    });
    next();
  };
}
