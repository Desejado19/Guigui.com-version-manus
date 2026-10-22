import type {
  DatabaseObservability,
  ObservabilityRepository,
} from '../application/observabilityService';

export type ObservabilityQueryPort = {
  query(
    text: string,
    values: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
};

export function createPostgresObservabilityRepository(
  queryPort: ObservabilityQueryPort | null,
): ObservabilityRepository {
  return {
    async persistRequestMetric(route, statusCode, durationMs) {
      if (!queryPort) return;
      await queryPort.query(
        `INSERT INTO request_metrics (metric_date,route,request_count,error_count,total_duration_ms)
         VALUES (CURRENT_DATE,$1,1,$2,$3)
         ON CONFLICT (metric_date,route) DO UPDATE SET request_count=request_metrics.request_count+1,
           error_count=request_metrics.error_count+EXCLUDED.error_count,
           total_duration_ms=request_metrics.total_duration_ms+EXCLUDED.total_duration_ms,
           updated_at=NOW()`,
        [
          route.slice(0, 255),
          statusCode >= 400 ? 1 : 0,
          Math.round(durationMs),
        ],
      );
    },
    async getDatabaseObservability() {
      if (!queryPort) return null;
      const result = await queryPort.query(
        `SELECT CURRENT_DATE::text AS "metricsDate", COALESCE(SUM(request_count),0)::int AS requests,
          COALESCE(SUM(error_count),0)::int AS errors FROM request_metrics WHERE metric_date=CURRENT_DATE`,
        [],
      );
      const row = result.rows[0];
      if (!row) return null;
      if (
        typeof row.metricsDate !== 'string'
        || typeof row.requests !== 'number'
        || typeof row.errors !== 'number'
      ) {
        throw new Error('Invalid database observability result');
      }
      const summary: DatabaseObservability = {
        metricsDate: row.metricsDate,
        requests: row.requests,
        errors: row.errors,
      };
      return summary;
    },
  };
}
