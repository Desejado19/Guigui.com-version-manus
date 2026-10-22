import { randomUUID } from 'node:crypto';
import { databasePool } from './db';

const allowedEvents = new Set([
  'page_view',
  'search_submitted',
  'search_result_clicked',
  'checkout_started',
  'payment_completed',
  'payment_failed',
  'ticket_purchased',
]);

export async function persistProductEvent(input: {
  eventName: string;
  source: string;
  appVersion?: string;
  userId?: string;
  sessionId?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  if (!databasePool || !allowedEvents.has(input.eventName)) return;
  await databasePool.query(
    `INSERT INTO product_events (id,event_name,source,app_version,user_id,session_id,context)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      `pe-${randomUUID()}`,
      input.eventName,
      input.source.slice(0, 120),
      (input.appVersion || '1').slice(0, 40),
      input.userId || null,
      input.sessionId?.slice(0, 120) || null,
      JSON.stringify(input.context || {}),
    ],
  );
}

export async function getProductFunnel(days = 30) {
  if (!databasePool) return { configured: false, days, stages: [] };
  const result = await databasePool.query(
    `SELECT event_name AS name, COUNT(*)::int AS count
     FROM product_events
     WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 day')
     GROUP BY event_name ORDER BY count DESC`,
    [Math.min(Math.max(days, 1), 365)],
  );
  return { configured: true, days, stages: result.rows };
}
