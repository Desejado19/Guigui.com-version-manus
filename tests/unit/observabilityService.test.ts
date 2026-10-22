import { describe, expect, it, vi } from 'vitest';
import {
  getAdminMetrics,
  renderPrometheusMetrics,
  type ObservabilityRepository,
} from '../../server/modules/platform-foundation/observability/application/observabilityService';
import { createPostgresObservabilityRepository } from '../../server/modules/platform-foundation/observability/adapters/postgresObservabilityRepository';
import type { HttpMetricsSnapshot } from '../../server/modules/platform-foundation/observability/domain/httpMetrics';

function createSnapshot(route = '/health'): HttpMetricsSnapshot {
  return {
    totalRequests: 2,
    errors: 1,
    routes: new Map([[route, { count: 2, errors: 1, totalMs: 31 }]]),
  };
}

describe('HTTP observability application services', () => {
  it('builds the admin summary and route average from a snapshot', async () => {
    const database = { metricsDate: '2026-10-22', requests: 7, errors: 3 };
    const repository: ObservabilityRepository = {
      persistRequestMetric: vi.fn().mockResolvedValue(undefined),
      getDatabaseObservability: vi.fn().mockResolvedValue(database),
    };

    await expect(getAdminMetrics(createSnapshot(), repository)).resolves.toEqual({
      totalRequests: 2,
      errors: 1,
      routes: [{ route: '/health', count: 2, errors: 1, averageMs: 15.5 }],
      database,
    });
  });

  it('returns null database summary and skips writes without a query port', async () => {
    const repository = createPostgresObservabilityRepository(null);

    await repository.persistRequestMetric('/health', 200, 8);

    await expect(getAdminMetrics(createSnapshot(), repository)).resolves.toMatchObject({
      database: null,
    });
  });

  it('persists 4xx responses as database errors', async () => {
    const query = vi.fn(async (_text: string, _values: unknown[]) => ({
      rows: [] as Record<string, unknown>[],
    }));
    const repository = createPostgresObservabilityRepository({ query });
    const route = 'r'.repeat(260);

    await repository.persistRequestMetric(route, 404, 37);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('VALUES (CURRENT_DATE,$1,1,$2,$3)');
    expect(query.mock.calls[0][1]).toEqual([route.slice(0, 255), 1, 37]);
  });

  it('aggregates database metrics for the current date', async () => {
    const query = vi.fn(async (_text: string, _values: unknown[]) => ({
      rows: [{
        metricsDate: '2026-10-22',
        requests: 7,
        errors: 3,
      }] as Record<string, unknown>[],
    }));
    const repository = createPostgresObservabilityRepository({ query });

    await expect(repository.getDatabaseObservability()).resolves.toEqual({
      metricsDate: '2026-10-22',
      requests: 7,
      errors: 3,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE metric_date=CURRENT_DATE'), []);
  });

  it('renders Prometheus metric names, types, values, labels, and final newline', async () => {
    const repository: ObservabilityRepository = {
      persistRequestMetric: vi.fn().mockResolvedValue(undefined),
      getDatabaseObservability: vi.fn().mockResolvedValue({
        metricsDate: '2026-10-22',
        requests: 7,
        errors: 3,
      }),
    };

    await expect(renderPrometheusMetrics(createSnapshot(), repository)).resolves.toBe([
      '# HELP guigui_http_requests_total Total HTTP requests observed by this process.',
      '# TYPE guigui_http_requests_total counter',
      'guigui_http_requests_total 2',
      '# HELP guigui_http_errors_total Total HTTP responses with status 500 or higher.',
      '# TYPE guigui_http_errors_total counter',
      'guigui_http_errors_total 1',
      '# HELP guigui_http_route_requests_total HTTP requests by route.',
      '# TYPE guigui_http_route_requests_total counter',
      'guigui_http_route_requests_total{route="/health"} 2',
      '# HELP guigui_persistent_requests_total Requests persisted in PostgreSQL for the current day.',
      '# TYPE guigui_persistent_requests_total gauge',
      'guigui_persistent_requests_total 7',
      '# HELP guigui_persistent_errors_total Errors persisted in PostgreSQL for the current day.',
      '# TYPE guigui_persistent_errors_total gauge',
      'guigui_persistent_errors_total 3',
      '',
    ].join('\n'));
  });

  it('escapes route labels in Prometheus exposition', async () => {
    const repository: ObservabilityRepository = {
      persistRequestMetric: vi.fn().mockResolvedValue(undefined),
      getDatabaseObservability: vi.fn().mockResolvedValue(null),
    };

    const route = String.raw`/items\detail?query="x"`;
    const text = await renderPrometheusMetrics(createSnapshot(route), repository);

    expect(text).toContain(String.raw`route="/items\\detail?query=\"x\""`);
    expect(text.endsWith('\n')).toBe(true);
  });
});
