import type { RequestHandler } from 'express';
import {
  getAdminMetrics,
  renderPrometheusMetrics,
  type ObservabilityRepository,
} from '../application/observabilityService';
import type { HttpMetricsRegistry } from '../domain/httpMetrics';

export type ObservabilityHandlerDependencies = {
  registry: HttpMetricsRegistry;
  repository: ObservabilityRepository;
};

export function createObservabilityHandlers(
  dependencies: ObservabilityHandlerDependencies,
): {
  adminMetrics: RequestHandler;
  prometheusMetrics: RequestHandler;
} {
  return {
    adminMetrics: async (_request, response, next) => {
      try {
        response.json(await getAdminMetrics(
          dependencies.registry.snapshot(),
          dependencies.repository,
        ));
      } catch (error) {
        next(error);
      }
    },
    prometheusMetrics: async (_request, response, next) => {
      try {
        const exposition = await renderPrometheusMetrics(
          dependencies.registry.snapshot(),
          dependencies.repository,
        );
        response.type('text/plain').send(exposition);
      } catch (error) {
        next(error);
      }
    },
  };
}
