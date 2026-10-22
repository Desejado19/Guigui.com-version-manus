import type { HttpMetricsSnapshot } from '../domain/httpMetrics';

export type DatabaseObservability = {
  metricsDate: string;
  requests: number;
  errors: number;
};

export interface ObservabilityRepository {
  persistRequestMetric(route: string, statusCode: number, durationMs: number): Promise<void>;
  getDatabaseObservability(): Promise<DatabaseObservability | null>;
}

export type AdminMetricsResponse = {
  totalRequests: number;
  errors: number;
  routes: Array<{
    route: string;
    count: number;
    errors: number;
    averageMs: number;
  }>;
  database: DatabaseObservability | null;
};

export async function getAdminMetrics(
  snapshot: HttpMetricsSnapshot,
  repository: ObservabilityRepository,
): Promise<AdminMetricsResponse> {
  const routes = Array.from(snapshot.routes, ([route, metrics]) => ({
    route,
    count: metrics.count,
    errors: metrics.errors,
    averageMs: metrics.count
      ? Math.round((metrics.totalMs / metrics.count) * 100) / 100
      : 0,
  }));
  return {
    totalRequests: snapshot.totalRequests,
    errors: snapshot.errors,
    routes,
    database: await repository.getDatabaseObservability(),
  };
}

export async function renderPrometheusMetrics(
  snapshot: HttpMetricsSnapshot,
  repository: ObservabilityRepository,
): Promise<string> {
  const database = await repository.getDatabaseObservability();
  const lines = [
    '# HELP guigui_http_requests_total Total HTTP requests observed by this process.',
    '# TYPE guigui_http_requests_total counter',
    `guigui_http_requests_total ${snapshot.totalRequests}`,
    '# HELP guigui_http_errors_total Total HTTP responses with status 500 or higher.',
    '# TYPE guigui_http_errors_total counter',
    `guigui_http_errors_total ${snapshot.errors}`,
    '# HELP guigui_http_route_requests_total HTTP requests by route.',
    '# TYPE guigui_http_route_requests_total counter',
  ];
  for (const [route, metrics] of snapshot.routes) {
    const label = route.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`guigui_http_route_requests_total{route="${label}"} ${metrics.count}`);
  }
  if (database) {
    lines.push(
      '# HELP guigui_persistent_requests_total Requests persisted in PostgreSQL for the current day.',
      '# TYPE guigui_persistent_requests_total gauge',
      `guigui_persistent_requests_total ${database.requests}`,
      '# HELP guigui_persistent_errors_total Errors persisted in PostgreSQL for the current day.',
      '# TYPE guigui_persistent_errors_total gauge',
      `guigui_persistent_errors_total ${database.errors}`,
    );
  }
  return `${lines.join('\n')}\n`;
}
