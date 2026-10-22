import { databasePool } from './db';

export async function consumeDistributedRateLimit(key: string, windowMs: number, maxRequests: number): Promise<boolean | null> {
  if (!databasePool) return null;
  const result = await databasePool.query(
    `INSERT INTO rate_limit_buckets (bucket_key,window_started_at,request_count,updated_at)
     VALUES ($1,NOW(),1,NOW())
     ON CONFLICT (bucket_key) DO UPDATE SET
       window_started_at=CASE WHEN EXTRACT(EPOCH FROM (NOW()-rate_limit_buckets.window_started_at))*1000 >= $2 THEN NOW() ELSE rate_limit_buckets.window_started_at END,
       request_count=CASE WHEN EXTRACT(EPOCH FROM (NOW()-rate_limit_buckets.window_started_at))*1000 >= $2 THEN 1 ELSE rate_limit_buckets.request_count+1 END,
       updated_at=NOW()
     RETURNING request_count`,
    [key, windowMs],
  );
  return Number(result.rows[0]?.request_count || maxRequests + 1) <= maxRequests;
}
