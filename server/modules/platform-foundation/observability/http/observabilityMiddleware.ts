import type { Request, RequestHandler } from 'express';
import { sanitizeDiagnostic } from '../../diagnostics/sanitizeDiagnostic';
import type { HttpMetricsRegistry } from '../domain/httpMetrics';

export function normalizePersistentRoute(routeTemplate: string | undefined): string {
  return routeTemplate ? routeTemplate.slice(0, 255) : 'unmatched';
}

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
      const routeTemplate = typeof request.route?.path === 'string'
        ? request.route.path
        : undefined;
      const route = routeTemplate || request.path;
      dependencies.registry.record(route, response.statusCode, durationMs);
      void dependencies.persistRequestMetric(
        normalizePersistentRoute(routeTemplate),
        response.statusCode,
        durationMs,
      ).catch((error: unknown) => {
        dependencies.logger.error(JSON.stringify({
          event: 'observability_persist_failed',
          requestId,
          message: sanitizeDiagnostic(error),
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
