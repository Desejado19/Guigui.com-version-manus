export type RouteHttpMetric = {
  count: number;
  errors: number;
  totalMs: number;
};

export type HttpMetricsSnapshot = {
  totalRequests: number;
  errors: number;
  routes: ReadonlyMap<string, RouteHttpMetric>;
};

export class HttpMetricsRegistry {
  private totalRequests = 0;
  private errors = 0;
  private readonly routes = new Map<string, RouteHttpMetric>();

  record(route: string, statusCode: number, durationMs: number): void {
    const metric = this.routes.get(route) ?? { count: 0, errors: 0, totalMs: 0 };
    metric.count += 1;
    metric.totalMs += durationMs;
    if (statusCode >= 500) {
      metric.errors += 1;
      this.errors += 1;
    }
    this.routes.set(route, metric);
    this.totalRequests += 1;
  }

  snapshot(): HttpMetricsSnapshot {
    return {
      totalRequests: this.totalRequests,
      errors: this.errors,
      routes: new Map(
        Array.from(this.routes, ([route, metric]) => [route, { ...metric }]),
      ),
    };
  }
}
