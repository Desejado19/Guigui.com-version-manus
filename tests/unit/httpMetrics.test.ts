import { describe, expect, it } from 'vitest';
import { HttpMetricsRegistry } from '../../server/modules/platform-foundation/observability/domain/httpMetrics';

describe('HttpMetricsRegistry', () => {
  it('records total requests and independent route counters', () => {
    const registry = new HttpMetricsRegistry();

    registry.record('GET /health', 200, 12);
    registry.record('GET /events', 404, 19);

    const snapshot = registry.snapshot();
    expect(snapshot.totalRequests).toBe(2);
    expect(snapshot.errors).toBe(0);
    expect(snapshot.routes.get('GET /health')).toEqual({
      count: 1,
      errors: 0,
      totalMs: 12,
    });
    expect(snapshot.routes.get('GET /events')).toEqual({
      count: 1,
      errors: 0,
      totalMs: 19,
    });
  });

  it('keeps 4xx out of in-memory errors while counting 5xx', () => {
    const registry = new HttpMetricsRegistry();

    registry.record('GET /missing', 400, 4);
    registry.record('GET /broken', 500, 8);

    const snapshot = registry.snapshot();
    expect(snapshot.errors).toBe(1);
    expect(snapshot.routes.get('GET /missing')?.errors).toBe(0);
    expect(snapshot.routes.get('GET /broken')?.errors).toBe(1);
  });

  it('does not let snapshot callers mutate registry state', () => {
    const registry = new HttpMetricsRegistry();
    registry.record('GET /health', 200, 12);

    const snapshot = registry.snapshot();
    const metric = snapshot.routes.get('GET /health');
    if (!metric) throw new Error('Expected route metric in snapshot');
    metric.count = 99;
    metric.errors = 99;
    metric.totalMs = 99;

    expect(registry.snapshot().routes.get('GET /health')).toEqual({
      count: 1,
      errors: 0,
      totalMs: 12,
    });
  });
});
