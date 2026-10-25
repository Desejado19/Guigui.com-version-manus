INSERT INTO request_metrics (
  metric_date,
  route,
  request_count,
  error_count,
  total_duration_ms,
  updated_at
)
SELECT
  metric_date,
  'unmatched',
  SUM(request_count),
  SUM(error_count),
  SUM(total_duration_ms),
  MAX(updated_at)
FROM request_metrics
WHERE route <> 'unmatched'
GROUP BY metric_date
ON CONFLICT (metric_date, route) DO UPDATE
SET request_count = request_metrics.request_count + EXCLUDED.request_count,
    error_count = request_metrics.error_count + EXCLUDED.error_count,
    total_duration_ms = request_metrics.total_duration_ms + EXCLUDED.total_duration_ms,
    updated_at = GREATEST(request_metrics.updated_at, EXCLUDED.updated_at);

DELETE FROM request_metrics
WHERE route <> 'unmatched';

UPDATE product_events
SET context = '{}'::jsonb
WHERE context IS DISTINCT FROM '{}'::jsonb;

CREATE INDEX IF NOT EXISTS product_events_retention_idx
  ON product_events (occurred_at);
